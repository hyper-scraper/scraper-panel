'use strict';

var async = require('async')
  , DbWriter = require('./db-writer')
  , phoneService = require('../phones')
  , util = require('util');


/**
 * Posrednikov scraper
 *
 * @constructor
 * @extends {DbWriter}
 */
function PosrednikovScraper(options) {
  DbWriter.call(this, options);

  this.config.externalJQuery = options.externalJQuery || false;
  this.config.BASE_URL = 'http://real.nn.ru/ad2';
}
util.inherits(PosrednikovScraper, DbWriter);


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

        if (!tokens.length || tokens.join(',').match(/^–+$/g)) {
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
      phone = phoneDirty.replace(/[^0-9]/g, '');
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


module.exports = PosrednikovScraper;