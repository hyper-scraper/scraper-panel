'use strict';

var async = require('async')
  , BaseScraper = require('./base-scraper')
  , crypto = require('crypto')
  , db = require('../db')
  , http = require('http')
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
 * Posrednikov scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function PosrednikovScraper(options) {
  BaseScraper.call(this, options);

  var self = this
    , logger = this.getLogger();

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://real.nn.ru/ad2';

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
util.inherits(PosrednikovScraper, BaseScraper);


/**
 * Get list of latest ads from first page in selected category on Avito.
 *
 * @see {BaseScraper.getItemList}
 */
PosrednikovScraper.prototype.getItemList = function(page, callback) {
  var config = this.config
    , url = config.SEARCH_URL
    , self = this;

  this.openAndRun(
    page,
    url,
    function() {
      var list = document.querySelectorAll('a[href*="/offer.php"]')
        , map = [].map
        , urls;

      urls = map.call(list, function(x) {
        return x.href.replace(/nizhniynovgorod\./, '');
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
PosrednikovScraper.prototype.getItemData = function(page, url, callback) {
  var self = this
    , started = new Date();

  this.openAndRun(page, url,
    function getData() {
      function $(sel, start) {
        start = start || document;
        return start.querySelector(sel);
      }

      var $row = $('table.tab tr:nth-child(2)')
        , title = $('td:nth-child(3) b', $row).textContent
        , name = null
        , id = window.location.href.match(/=[0-9]+$/)
        , addrDirty = $('td:nth-child(3)', $row).innerHTML.replace(/<br\/?>/g, ' ').replace(/<[^>]+>/g, '')
        , city = null
        , priceDirty = $('td:nth-child(4)', $row).textContent.trim().split('\n')
        , price = null
        , price_type = null
        , keywords = [
          'Этажность',
          'Площадь',
          'Быт'
        ]
        , i = 0
        , description = $('td:nth-child(8)', $row)
          .textContent.trim()
          .replace(/[\s\t]+/gm, ' ')
        , imageUrl = null
        , isPrivate = true
        , nobr = document.querySelectorAll('nobr')
        , phoneDirty = nobr[nobr.length - 1].textContent
        , phone
        , idx;

      // adv id
      if (id) {
        id = id.shift().substring(1);
      }

      // address
      if (addrDirty) {
        idx = addrDirty.indexOf(title);
        var addr = [
          addrDirty.substring(0, idx).trim(),
          addrDirty.substring(idx + title.length).trim()
        ];

        city = addr.join(', ');
        city = city.replace(/&[^;]+;/g, '');
      }

      // price and price type
      if (priceDirty) {
        var token = priceDirty.pop();
        price = token.replace(/[^0-9]/g, '');
        price_type = token.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();

        if (token = priceDirty.shift()) {
          price_type += ', ' + token.trim();
        }
      }

      // keywords
      while (i++ < 3) {
        var text = $('td:nth-child(' + (i + 4) + ')', $row).textContent
          , tokens = text.split('\n');
        tokens.forEach(function(t, i) {
          tokens[i] = t.trim();
        });

        tokens = tokens.filter(function(t) {
          return t.length > 0;
        });

        if (!tokens.length || tokens.join().match(/^–+$/g)) {
          keywords[i - 1] = null;
        } else if (tokens.length) {
          keywords[i - 1] += ': ' + tokens.join(', ');
        }
      }

      keywords = keywords.filter(function(txt) {
        return txt;
      });

      // description
      idx = description.indexOf('Контакты: ');
      description = description.slice(0, idx);

      // phone
      phone = phoneDirty.replace().replace(/[^0-9]/g, '');
      if (phone.length === 11 && phone[0] === '7') {
        phone = '8' + phone.substring(1);
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
    },
    function(json) {
      var data
        , k;

      if (!(data = self.tryParseJson(json, callback))) {
        return;
      }

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
PosrednikovScraper.prototype.filterList = function(list, callback) {
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


module.exports = PosrednikovScraper;