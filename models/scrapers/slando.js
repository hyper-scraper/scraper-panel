'use strict';

var async = require('async')
  , DbWriter = require('./db-writer')
  , phoneService = require('../phones')
  , util = require('util');


/**
 * Slando scraper
 *
 * @constructor
 * @extends {DbWriter}
 */
function SlandoScraper(options) {
  DbWriter.call(this, options);

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://slando.ru';
}
util.inherits(SlandoScraper, DbWriter);


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


module.exports = SlandoScraper;