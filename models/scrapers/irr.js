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
 * IRR scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function IRRScraper(options) {
  BaseScraper.call(this, options);

  var self = this
    , logger = this.getLogger();

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://www.irr.ru';

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
util.inherits(IRRScraper, BaseScraper);


/**
 * Get list of latest ads from first page in selected category on Avito.
 *
 * @see {BaseScraper.getItemList}
 */
IRRScraper.prototype.getItemList = function(page, callback) {
  var config = this.config
    , url = config.SEARCH_URL
    , self = this;

  this.openAndRun(
    page,
    url,
    function() {
      var elements = $('td.tdTxt > .h3 > a:visible')
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
IRRScraper.prototype.getItemData = function(page, url, callback) {
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
          $('.cb_picture:visible').click();
        },
        timeout: IMG_LOAD_TIMEOUT
      },
      function getData() {
        var title = $('.wrapTitleLeft.cb_header').text()
          , name = null
          , id = $('.b-infAdvert .floatLeft p:first').text().match(/[0-9]+/).shift()
          , city = $('.b-adressAdv .h3').text()
          , price = $('.prise .red').text().replace(/[^0-9]/g, '') || null
          , price_type = $('#currencySelected').text() || null
          , $kw = $('#allParams tr')
          , keywords = []
          , description = $('.txtAdvert .advert_text').text()
          , imageUrl = $('.photoOrig > img').attr('src') || null
          , isPrivate = $('.b-infAdvert .gray').text().indexOf('Частное') !== -1
          , phoneDirty = $('.b-owner .wrapIcons').text().match(/[\+\-\(\) 0-9]+/)
          , phone = null;

        // keywords
        $kw.each(function() {
          if ($(this).children().length == 2) {
            var $children = $(this).children()
              , kv = ['first', 'last'].map(function(method) {
              return $children[method]().text().trim();
            }, this);
            keywords.push(kv.join(': '))
          }
        });

        if (phoneDirty) {
          phone = phoneDirty
            .shift()
            .replace(/[^0-9]/g, '');

          if (phone.length === 11 && phone[0] === '7') {
            phone = '8' + phone.substring(1);
          }
        }

        if (!isPrivate) {
          name = $('.nameConpany b').text();

          if ($('.b-owner .wrapMargin').children().length == 2) {
            name += ', ' + $('.b-owner .wrapMargin')
              .children()
              .first()
              .html()
              .replace(/^[^>]+>/, '')
              .trim()
          }
        } else if (phoneDirty) {
          var matches = $('.b-owner .wrapIcons')
            .first()
            .text().trim()
            .split(/\s+/, 2);

          if (matches.length == 2) {
            matches.shift();
            name = matches.shift();
            matches = null;
          }
        }

        return JSON.stringify({
          ad_title:          title,
          ad_description:    keywords.join('\n') + '\n' + description,
          ad_landlord_name:  name,
          ad_landlord_type:  isPrivate ? 'private' : 'agency',
          ad_landlord_phone: phone,
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

      callback(null, data);
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
IRRScraper.prototype.filterList = function(list, callback) {
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


module.exports = IRRScraper;