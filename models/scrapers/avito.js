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
 * Avito scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function AvitoScraper(options) {
  BaseScraper.call(this, options);

  var self = this
    , logger = this.getLogger();

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://www.avito.ru';

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
          item.checksum = sha1(item.sid, ':', item.ad_url);

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
util.inherits(AvitoScraper, BaseScraper);


/**
 * Get list of latest ads from first page in selected category on Avito.
 *
 * @see {BaseScraper.getItemList}
 */
AvitoScraper.prototype.getItemList = function(page, callback) {
  var config = this.config
    , url = config.SEARCH_URL
    , self = this;

  this.openAndRun(
    page,
    url,
    function() {
      var elements = $('.t_i_title .t_i_h3 a')
        , urls = [];

      elements.each(function() {
        urls.push($(this).attr('href'));
      });

      return JSON.stringify(urls);
    },
    function(json) {
      var urls = self.tryParseJson(json, callback);
      if (!urls) {
        return;
      }
      urls = urls.map(function(url) {
        return config.BASE_URL + url;
      });
      urls && callback(null, urls);
    }
  );
};


/**
 * Get ad data
 *
 * @see {BaseScraper.getItemData}
 */
AvitoScraper.prototype.getItemData = function(page, url, callback) {
  var config = this.config
    , self = this
    , exited = false
    , started = new Date();

  function onError(err) {
    if (err && !exited) {
      exited = true;
      console.log('LOOOL: %s', err);
      callback(err);
    }
  }

  page.once('error', onError);

  this.openAndRun(page, url,
    [
      {
        code:    function() {
          $('#phone').find('a').click();
        },
        timeout: 1500
      },
      function() {
        var title = $('h1.p_i_ex_title').html()
          , $seller = $('#seller')
          , name = $seller.find('strong').html()
          , id = $('#item_id').html()
          , city = $('#map').find('a').html()
          , $price = $('span.p_i_price strong')[0].childNodes
          , price = null
          , price_type = null
          , $kw = $('dl.description.b_d_l .b_d_params div:first-child').children()
          , keywords = []
          , description = $('#desc_text').html()
          , $image = $('td.big-picture > img')
          , imgCoords
          , isPrivate = ($seller.find('span.grey').length === 0)
          , $phone = $('#phone')
          , phoneCoords;

        function getImageCoords($img) {
          if (!$img.length) {
            return null;
          }
          var offset = $img.offset();
          return {
            top:    offset.top,
            left:   offset.left,
            width:  $img.width(),
            height: $img.height()
          };
        }

        // price parts: number and measure
        if ($price.length) {
          price = $price[0].textContent.replace(/[^0-9]/g, '');
          if ($price.length > 1) {
            price_type = $price[1].textContent.replace(/[\n\r\s\t ]/g, '');
          }
        }

        // keywords
        $kw.each(function() {
          keywords.push($(this).html().trim());
        });

        // image coords
        imgCoords = getImageCoords($image);

        // show number and get image coords
        phoneCoords = getImageCoords($phone.find('img'));
        if (phoneCoords) {
          phoneCoords.top -= 2.5;
          phoneCoords.left -= 2.5;
          phoneCoords.width += 5;
          phoneCoords.height += 5;
        }

        return JSON.stringify({
          ad_title:          title,
          ad_description:    keywords.join(' ') + '\n' + description,
          ad_landlord_name:  name,
          ad_landlord_type:  isPrivate ? 'private' : 'agency',
          ad_landlord_phone: phoneCoords,
          ad_id:             id,
          ad_city:           city,
          ad_price:          price,
          ad_price_type:     price_type,
          ad_picture:        imgCoords,
          ad_url:            window.location.href
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

      // get images for phone, picture
      async.series([

        // Do we have phone to identify, check if it's in blacklist?
        function(outerCallback) {
          if (!data.ad_landlord_phone) {
            outerCallback();
            return;
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
                var query = 'modify=-resize,250x';
                var body = {lang: 'rus', type: 'png'};
                phoneService.OCR(buf, query, body, innerCallback);
              },
              // in blacklist?
              function(phone, innerCallback) {
                data.ad_landlord_phone = phone;
                phoneService.isBlocked(phone, innerCallback);
              }
            ],
            function(err, isBlocked) {
              data.blocked = isBlocked;
              outerCallback(err);
            }
          );
        },

        // Do we have ad picture to save?
        function(outerCallback) {
          if (!data.ad_picture) {
            outerCallback();
            return;
          }

          var coords = data.ad_picture;
          self._renderImage(page, 'png', coords, function(err, buf) {
            data.ad_picture = buf.toString('base64');
            outerCallback(err);
          });
        }
      ], function(err) {
        callback(err, data);
      });
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
AvitoScraper.prototype.filterList = function(list, callback) {
  var config = this.config;

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


module.exports = AvitoScraper;