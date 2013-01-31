'use strict';

var async = require('async')
  , BaseScraper = require('./base-scraper')
  , crypto = require('crypto')
  , db = require('../db')
  , http = require('http')
  , phoneService = require('../phones')
  , Advertisement = db.Advertisement
  , Execution = db.Execution
  , util = require('util')
  , __slice = [].slice;


/**
 * Make SHA-1 hash
 */
function sha1() {
  var args = __slice.call(arguments, 0);
  return crypto
    .createHash('sha1')
    .update(args.join(''), 'utf8')
    .digest('hex');
}


/**
 * Slando scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function SlandoScraper(options) {
  BaseScraper.call(this, options);

  var self = this
    , logger = this.getLogger();

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://slando.ru';

  this.on('execution:error', function(err) {
    if (!err) {
      err = 'Unknown error';
    } else if (err.stack) {
      err = err.stack;
    }

    Execution
      .insert({
        sid:         self.config.SID,
        start_time:  self.started,
        finish_time: self.finished,
        error:       err
      })
      .exec(function(err) {
        delete self.started;
        if (err) {
          logger.error('Error occurred during execution creation: %s', err);
        }
      });
  });

  this.on('execution:finished', function(data) {
    Execution
      .insert({
        sid:         self.config.SID,
        start_time:  self.started,
        finish_time: self.finished,
        records:     data.length,
        error:       null
      })
      .exec(function(err, res) {
        async.forEach(data, function(item, cb) {
          // if [url, error]
          if (Array.isArray(item)) {
            item = {
              ad_url: item[0],
              error:  item[1].stack ? item[1].stack : item[1]
            };
          }

          item.sid = self.config.SID;
          item.eid = res.insertId;
          item.checksum = sha1(item.sid, ':', item.ad_url, ':', item.error);

          Advertisement
            .insert(item)
            .exec(function(err) {
              if (err) {
                logger.error('Error occurred during ad creation: %s', err);
              }
              cb();
            })
        }, function() {
        });
      });
  });
}
util.inherits(SlandoScraper, BaseScraper);


/**
 * Get list of latest ads from first page in selected category on Avito.
 *
 * @see {BaseScraper.getItemList}
 */
SlandoScraper.prototype.getItemList = function(page, callback) {
  var config = this.config
    , url = config.SEARCH_URL
    , self = this;

  this.openAndRun(
    page,
    url,
    function() {
      var elements = $('a.link.linkWithHash.clicker:visible')
        , urls = [];

      elements.each(function() {
        urls.push($(this).attr('href').replace(/#.*$/, ''));
      });

      return JSON.stringify(urls);
    },
    function(json) {
      var urls = self.tryParseJson(json, callback);
      if (!urls) {
        return;
      }
      urls && callback(null, urls);
    }
  );
};


/**
 * Get ad data
 *
 * @see {BaseScraper.getItemData}
 */
SlandoScraper.prototype.getItemData = function(page, url, callback) {
  var config = this.config
    , self = this
    , IMG_LOAD_TIMEOUT = config.IMG_LOAD_TIMEOUT || 2000
    , exited = false
    , started = new Date();

  function onError(err) {
    if (err && !exited) {
      exited = true;
      callback(err);
    }
  }

  page.once('error', onError);

  this.openAndRun(page, url,
    [
      {
        code:    function() {
          $('a.link-phone').click();
        },
        timeout: IMG_LOAD_TIMEOUT
      },
      function() {
        var title = $('h1.offertitle').text()
          , name = $('.userbox .brkword').first().text()
          , id = $('.addetails .c62 .nowrap').html().match(/[0-9]+/).shift()
          , city = $('.locationbox .brkword').text().trim()
          , $price = $('.pricelabel strong')
          , price = 0
          , $details = $('table.details')
          , price_type = $details.find('td:first strong').text()
          , $kw = $details.find('td')
          , keywords = []
          , description = $details.next().text()
          , imageUrl = $('.gallery_img > img').attr('src') || null
          , isPrivate = null
          , $phone = $('img.contactimg').first()
          , phoneCoords = null;

        if ($price.length) {
          price = $price.html()
            .match(/[0-9 ]+/).shift()
            .replace(/ /g, '');
        }

        // keywords
        $kw.each(function() {
          var text = $(this).text();
          keywords.push(text.replace(/:[\n\r\t ]+/, ': ').trim());
        });
        // remove price type
        keywords.shift();

        // phone coords
        if ($phone.length) {
          phoneCoords = $phone.offset();
          phoneCoords.top -= 1.5;
          phoneCoords.left -= 1.5;
          phoneCoords.width = $phone.width() + 5;
          phoneCoords.height = $phone.height() + 5;
        }

        return JSON.stringify({
          ad_title:          title,
          ad_description:    keywords.join('\n') + '\n' + description,
          ad_landlord_name:  name,
          ad_landlord_type:  isPrivate ? 'private' : 'agency',
          ad_landlord_phone: phoneCoords,
          ad_id:             id,
          ad_city:           city,
          ad_price:          price,
          ad_price_type:     price_type,
          ad_picture:        imageUrl,
          ad_url:            window.location.href.replace(/#.*$/, '')
        });
      }
    ],
    function(json) {
      var data
        , k;

      if (exited || !(data = self.tryParseJson(json, callback))) {
        return;
      }

      exited = true;
      page.emit('error');

      data.create_time = started.toJSON();
      for (k in data) {
        if (data.hasOwnProperty(k)) {
          if (data[k] && typeof data[k] === 'string') {
            data[k] = data[k].trim();
            data[k] = data[k].replace(/<p>/g, '\n');
            data[k] = data[k].replace(/<\/p>/g, '');
          }
        }
      }

      if (!data.ad_landlord_phone) {
        data.blocked = false;
        return callback(null, data);
      }

      async.waterfall(
        [

          // render
          function(innerCallback) {
            var coords = data.ad_landlord_phone;
            self._renderImage(page, 'png', coords, innerCallback);
          },

          // OCR
          function(buf, innerCallback) {
            var query = 'modify=-resize,250x&png8=true';
            var body = {lang: 'rus', type: 'png'};
            phoneService.OCR(buf, query, body, innerCallback);
          },

          // in blacklist?
          function(phone, innerCallback) {
            if (Array.isArray(phone)) {
              data.ad_landlord_phone = phone.join(', ');
            } else {
              data.ad_landlord_phone = phone;
            }

            phoneService.isBlocked(phone, innerCallback);
          }

        ],
        function(err, isBlocked) {
          data.blocked = isBlocked;
          callback(err, data);
        }
      );
    }
  );
};


/**
 * Remove URLs that already have been processed
 *
 * @param {Array} list
 *    Array of URLs
 * @param {Function} callback
 *    Callback taking args (err, filtered)
 */
SlandoScraper.prototype.filterList = function(list, callback) {
  var config = this.config;
  if (!list.length) return callback(null, list);

  Advertisement
    .select('ad_url')
    .order('id DESC')
    .where({ad_url: list, error: null})
    .all(function(err, data) {
      var filtered;
      data.forEach(function(item) {
        var idx = list.indexOf(item.ad_url);
        if (idx !== -1) {
          list.splice(idx, 1);
        }
      });
      filtered = list;

      if (config.limit && config.limit < filtered.length) {
        filtered = filtered.slice(filtered.length - config.limit);
      }
      callback(null, filtered);
    });
};


module.exports = SlandoScraper;