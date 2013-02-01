'use strict';

var async = require('async')
  , DbWriter = require('./db-writer')
  , phoneService = require('../phones')
  , util = require('util');


/**
 * nn.ru scraper
 *
 * @constructor
 * @extends {DbWriter}
 */
function NNScraper(options) {
  DbWriter.call(this, options);

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://real.nn.ru/ad2';
}
util.inherits(NNScraper, DbWriter);


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
        ad_picture:        imageUrl
      });
    },
    function(json) {
      var data
        , k;

      if (!(data = self.tryParseJson(json, callback))) {
        return;
      }

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


module.exports = NNScraper;