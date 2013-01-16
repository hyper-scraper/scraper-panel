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
 * nn.ru scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function NNScraper(options) {
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
util.inherits(NNScraper, BaseScraper);


/**
 * Get list of latest ads from first page in selected category on Avito.
 *
 * @see {BaseScraper.getItemList}
 */
NNScraper.prototype.getItemList = function(page, callback) {
  var config = this.config
    , url = config.SEARCH_URL
    , self = this;

  this.openAndRun(
    page,
    url,
    function() {
      var elements = $('.rlItem .rlHead a')
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
      urls = urls.map(function(url) {
        return self.config.BASE_URL + url.substring(1);
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
NNScraper.prototype.getItemData = function(page, url, callback) {
  var self = this
    , started = new Date();

  this.openAndRun(page, url,
    function getData() {
      var title = $('table h1').text().replace(/[\s\t]+/g, ' ')
        , name = null
        , id = window.location.href.match(/=[0-9]+$/)
        , $addrImg = $('.rlParams').find('img[src*="map.gif"]')
        , city = null
        , price = $('.rlHItemR_R').text().match(/[0-9 ]+/)
        , price_type = $('.rlHItemR_R').text().trim().match(/[^ 0-9]+/)
        , $kw = $('.rlParams-elem')
        , keywords = []
        , description = $('#adtext-block').text()
        , imageUrl = null
        , isPrivate = true
        , phoneDirty = $('.rlTel').text().replace(/[\n\s\t]/g, '')
        , phone = null;

      // name, phone
      if (phoneDirty) {
        name = $('.rlTel').text().replace(/[\(\)0-9\+\-]/g, '').trim();
        phone = phoneDirty.replace(/[^0-9]/g, '');
      }

      // adv id
      if (id) {
        id = id.shift().substring(1);
      }

      // address
      if ($addrImg.length) {
        city = $addrImg.parent().text().replace(/^.*:/m, '');
      }

      // price and price type
      if (price) {
        price = price.shift().replace(/[^0-9]/g, '');
      }
      if (price_type) {
        price_type = price_type.shift();
      }

      // keywords
      $kw.each(function() {
        var text = $(this).text().trim().replace(/[\t\s]+/, ' ')
          , kv = [
            text.match(/^.*(?=:)/).shift(),
            text.match(/: .*$/).shift().substring(2)
          ];

        keywords.push(kv.join(': '));
      });

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
NNScraper.prototype.filterList = function(list, callback) {
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


module.exports = NNScraper;