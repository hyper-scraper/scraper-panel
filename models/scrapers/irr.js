'use strict';

var async = require('async')
  , DbWriter = require('./db-writer')
  , phoneService = require('../phones')
  , util = require('util');


/**
 * IRR scraper
 *
 * @constructor
 * @extends {DbWriter}
 */
function IRRScraper(options) {
  DbWriter.call(this, options);

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://www.irr.ru';
}
util.inherits(IRRScraper, DbWriter);


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
      function() {
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

      if (data.ad_landlord_phone) {
        phoneService.isBlocked(data.ad_landlord_phone, function(err, blocked) {
          data.blocked = blocked;
          callback(err, data);
        });
      } else {
        callback(null, data);
      }
    }
  );
};


module.exports = IRRScraper;