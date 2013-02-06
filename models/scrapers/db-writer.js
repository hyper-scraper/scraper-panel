'use strict';

var async = require('async')
  , BaseScraper = require('./base-scraper')
  , crypto = require('crypto')
  , db = require('../db')
  , util = require('util')
  , Advertisement = db.Advertisement
  , Execution = db.Execution
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
 * Abstract scraper class, writes data to DB
 *
 * @constructor
 * @extends {BaseScraper}
 * @param {*} options
 *    Scraper specific options
 */
function DbWriter(options) {
  BaseScraper.call(this, options);

  this.setupEventListeners();
}
util.inherits(DbWriter, BaseScraper);


/**
 * When scraper fires execution:* events we do save data to MySQL database
 */
DbWriter.prototype.setupEventListeners = function() {
  var self = this
    , logger = this.getLogger();

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
            if (item[1].stack) item[1] = item[1].stack;

            item = {
              ad_url: item[0],
              error:  Date.now() + ': ' + item[1]
            };
          }

          item.sid = self.config.SID;
          item.eid = res.insertId;
          item.checksum = sha1(item.sid, ':', item.ad_url, ':', item.error);

          if (!item.ad_landlord_phone && !item.error) {
            item.ad_landlord_phone = 'empty';
          }

          Advertisement
            .insert(item)
            .exec(function(err) {
              if (err) {
                logger.error('Error occurred during ad creation: %s', err);
              }
              cb();
            });
        }, function() {
        });
      });
  });
};


/**
 * Remove URLs that already have been processed
 *
 * @param {Array} list
 *    Array of URLs
 * @param {Function} callback
 *    Callback taking args (err, filtered)
 */
DbWriter.prototype.filterList = function(list, callback) {
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


(function() {
  module.exports = DbWriter;
})();
