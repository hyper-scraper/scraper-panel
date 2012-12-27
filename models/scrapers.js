'use strict';

var async = require('async')
  , BaseScraper = require('./scraper').BaseScraper
  , db = require('./db')
  , Advertisement = db.Advertisement
  , Execution = db.Execution
  , util = require('util');


/**
 * Avito scraper
 *
 * @constructor
 * @extends {BaseScraper}
 */
function AvitoScraper(options) {
  BaseScraper.call(this, options);

  var self = this;
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
        sid: self.config.SID,
        start_time: self.started,
        finish_time: self.finished,
        error: err
      })
      .exec(function(err) {
        delete self.started;
        if (err) {
          console.error('Error occurred during execution creation: %s', err);
        }
      });
  });

  this.on('execution:finished', function(data) {
    Execution
      .insert({
        sid: self.config.SID,
        start_time: self.started,
        finish_time: self.finished,
        records: data.length,
        error: null
      })
      .exec(function(err, res) {
        async.forEach(data, function(item, cb) {
          if (item instanceof Error) {
            item = {
              error: item.stack
            };
          } else if (typeof item === 'string') {
            item = {
              error: item
            };
          }

          item.sid = self.config.SID;
          item.eid = res.insertId;

          Advertisement
            .insert(item)
            .exec(function(err) {
              if (err) {
                console.error('Error occurred during ad creation: %s', err);
              }
              cb();
            })
        }, function() {});
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
    , self = this;

  console.log('Opening page: %s', url);
  this.openAndRun(page, url,
    function() {
      var title = $('h1.p_i_ex_title').html()
        , $seller = $('#seller')
        , name = $seller.find('strong').html()
        , id = $('#item_id').html()
        , city = $('#map').find('a').html()
        , $price = $('span.p_i_price strong')[0].childNodes
        , price = $price[0].textContent.replace(/[^0-9]/g, '')
        , price_type = $price[1].textContent.replace(/[\n\r\s\t ]/g, '')
        , $kw = $('dl.description.b_d_l .b_d_params div:first-child').children()
        , keywords = []
        , params = $('dl.description.b_d_l .b_d_params div:last-child')
          .html()
          .replace(/<[^>]+>/g, '')
        , description = $('#desc_text').html()
        , imgURL = ($('td.big-picture > img').attr('src') || '').replace(/^\/\//, '/')
        , isPrivate = ($seller.find('span.grey').length === 0);

      $kw.each(function() {
        keywords.push($(this).html().trim());
      });

      return JSON.stringify({
        ad_title: title,
        ad_description: keywords.join(' ') + '\n' + description,
        ad_landlord_name: name,
        ad_landlord_type: isPrivate ? 'private' : 'agency',
        ad_landlord_phone: 'In development',
        ad_id: id,
        ad_city: city,
        ad_price: price,
        ad_price_type: price_type,
        ad_picture: imgURL,
        ad_url: window.location.href
      });
    },
    function(json) {
      console.log('Got data for page: %s %s', url);
      console.log(json);
      var data = self.tryParseJson(json, callback);
      if (!data) {
        console.log('No data');
        return;
      }

      if (data.ad_picture) {
        data.ad_picture = config.BASE_URL + data.ad_picture;
      }

      for (var k in data) {
        if (data.hasOwnProperty(k) && data[k]) {
          data[k] = data[k].trim();
        }
      }
      console.log('Giving data back');
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
AvitoScraper.prototype.filterList = function(list, callback) {
  var config = this.config;

  Advertisement
    .select('ad_url')
    .order('id DESC')
    .where({ad_url: list})
    .one(function(err, data) {
      var filtered;
      if (!data) {
        filtered = list;
      } else {
        var idx = list.indexOf(data.ad_url);
        filtered = list.slice(0, idx);
      }

      if (config.limit && config.limit < filtered.length) {
        filtered = filtered.slice(filtered.length - config.limit);
      }
      callback(null, filtered);
    });
};


exports.AvitoScraper = AvitoScraper;