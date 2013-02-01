'use strict';

var async = require('async')
  , DbWriter = require('./db-writer')
  , phoneService = require('../phones')
  , util = require('util');


/**
 * Avito scraper
 *
 * @constructor
 * @extends {DbWriter}
 */
function AvitoScraper(options) {
  DbWriter.call(this, options);

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://www.avito.ru';
}
util.inherits(AvitoScraper, DbWriter);


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
          $('#phone').find('a').click();
        },
        timeout: IMG_LOAD_TIMEOUT
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
          , imageUrl = null
          , isPrivate = ($seller.find('span.grey').length === 0)
          , $phone = $('#phone').find('img')
          , phoneCoords = null;

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
        if ($image.length) {
          imageUrl = $image.attr('src');
        }

        // show number and get image coords
        if ($phone.length) {
          phoneCoords = $phone.offset();
          phoneCoords.top -= 1.5;
          phoneCoords.left -= 1.5;
          phoneCoords.width = $phone.width() + 5;
          phoneCoords.height = $phone.height() + 5;
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
          ad_picture:        imageUrl
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
      data.ad_url = url;

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
        callback(null, data);
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
          callback(err, data);
        }
      );
    }
  );
};


module.exports = AvitoScraper;