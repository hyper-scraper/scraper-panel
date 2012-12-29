'use strict';

var async = require('async')
  , EventEmitter = require('events').EventEmitter
  , phantomProxy = require('phantom-proxy')
  , poolModule = require('generic-pool')
  , log = require('../log')
  , phantomLogger = log.getLogger('PhantomJS')
  , poolLogger = log.getLogger('Phantom pool')
  , util = require('util')
  , exec = require('child_process').exec;


process.on('SIGINT', function() {
  process.emit('stop:wait');
  exec('killall -9 phantomjs', function() {
    process.emit('stop:done');
  });
});

/**
 * Abstract scraper class
 *
 * @constructor
 * @extends {EventEmitter}
 * @param {*} options
 *    Scraper specific options
 * @param {*} [options.phantom]
 *    PhantomJS webpage options
 * @param {*} [options.pool]
 *    Scraper pages pool configuration
 * @param {Number} [options.pool.POOL_MIN]
 *    Min size of 'webpage' instances. Default: 0
 * @param {Number} [options.pool.POOL_MAX]
 *    Max size of 'webpage' instances. Default: 5
 * @param {Number} [options.pool.POOL_IDLE]
 *    Max time one idle instance may be alive. Default: 10000
 * @param {Boolean} [options.pool.debug]
 *    Debug pool or not. Default: false
 * @param {Number} [options.WAIT_MIN]
 *    Min wait time before opening page (ms). Default: 3000
 * @param {Number} [options.WAIT_MAX]
 *    Max wait time before opening page (ms). Default: 7000
 * @param {Number} [options.WAIT_JS]
 *    How much time to wait while jQuery is loaded (ms). Default: 2000
 */
function BaseScraper(options) {
  EventEmitter.call(this);

  this.config = options;
  this.startPool();
}
util.inherits(BaseScraper, EventEmitter);


/**
 * Create pool of PhantomJS pages
 */
BaseScraper.prototype.startPool = function() {
  var config = this.config
    , phantomConf = config.phantom || {}
    , poolConf = config.pool || {}
    , min = poolConf.min || 0
    , max = poolConf.max || 5
    , maxIdle = poolConf.idle || 1000
    , debug = poolConf.debug || false
    , logger = this.getLogger();

  //noinspection JSValidateTypes
  this.pool = poolModule.Pool({
    name:              'phantom-' + config.SID,
    create:            function(callback) {
      phantomProxy.create(
        phantomConf,
        function(proxy) {
          proxy.page.on('error', function(err) {
            if (err) {
              phantomLogger.error('Uncaught error: %s', err);
            }
          });
          callback(null, proxy);
        }
      );
    },
    destroy:           function(proxy) {
      proxy.end(function() {
        // something here needed?
      });
    },
    min:               min,
    max:               max,
    idleTimeoutMillis: maxIdle,
    log:               debug ? poolLogger : debug
  });

  logger.info('Created pool %s for scraper', this.pool.getName());
};


/**
 * Helper to get webpage instance from pool
 *
 * @param {Function} callback
 *    Function taking pool error, Phantom webpage instance, and function
 *    which returns page back to pool and calls async.js callback:
 *    (err, page, fn)
 * @param {Function} [asyncCallback]
 *    async.js callback
 */
BaseScraper.prototype.acquirePage = function(callback, asyncCallback) {
  var pool = this.pool;
  pool.acquire(function(err, proxy) {
    if (err) {
      console.error(err);
    }

    callback(err, proxy.page, function(err) {
      if (proxy) {
        pool.release(proxy);
        asyncCallback && asyncCallback(err);
      }
    });
  }, 0);
};


/**
 * Run scraper
 */
BaseScraper.prototype.run = function() {
  var self = this
    , pool = this.pool;

  self.started = new Date();
  self.emit('execution:start');
  async.waterfall([
    // get list
    function(cb) {
      pool.acquire(function(err, proxy) {
        if (err) {
          cb(err);
          pool.release(proxy);
        } else {
          self.getItemList(proxy.page, function(err, list) {
            pool.release(proxy);
            cb(err, list);
          });

        }
      });
    },

    // filter out
    function(list, cb) {
      var nodups = [];
      list.forEach(function(url) {
        if (nodups.indexOf(url) === -1) {
          nodups.push(url);
        }
      });

      // freeing old array
      while (list.shift()) {
        void(0);
      }

      self.filterList(nodups, cb);
    },

    // get data
    function(filtered, cb) {
      if (!filtered.length) {
        cb(null, filtered);
        return;
      }

      filtered.reverse();
      var data = [];
      async.forEachSeries(filtered, function(url, asyncCallback) {
        pool.acquire(function(err, proxy) {
          if (err) {

            data.push([url, err]);
            console.error('Error acquiring page: ' + err);
            asyncCallback();

          } else {

            self.getItemData(proxy.page, url, function(err, item) {
              if (err) {
                data.push([url, err]);
              } else if (item) {
                data.push(item);
              }

              pool.release(proxy);
              asyncCallback();
            });

          }
        });
      }, function(err) {
        cb(err, data);
      });
    }
  ], function(err, result) {
    self.finished = new Date();
    if (err) {
      self.emit('execution:error', err);
    } else {
      self.emit('execution:finished', result);
    }
  });
};


/**
 * This helper does following:
 *    1. Calculates time to wait before opening page and waits.
 *    2. Injects jQuery and wait while it's being loaded.
 *    3. Evaluates function and returns it's result to callback.
 *
 * @param {*} page
 *    Phantom page object
 * @param {string} url
 *    URL address to open
 * @param {Function} code
 *    Code to be run in page
 * @param {Function} callback
 *    Callback which takes result of code
 * @param {boolean} [async]
 *    Whether run page#evaluateAsync or page#evaluate. Default: false
 */
BaseScraper.prototype.openAndRun = function(page, url, code, callback, async) {
  var self = this
    , logger = this.getLogger()
    , config = this.config
    , externalJQuery = !!config.externalJQuery
    , loaded = false
    , minWait = config.WAIT_MIN || 3000
    , maxWait = config.WAIT_MAX || 7000
    , jsWait = config.WAIT_JS || 2000
    , waitTime = minWait + Math.random() * (maxWait - minWait)
    , evaluateFunc = async === true ? page.evaluateAsync : page.evaluate;

  logger.debug('Waiting %dms to open page', Number(waitTime).toFixed(0));
  setTimeout(function realOpenAndRun() {
    page.open(url, function(status) {
      if (!loaded) {
        loaded = true;
      } else {
        return;
      }

      logger.info('Url: %s, status: %s', url, status);
      if (externalJQuery) {
        page.includeJs(
          'http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js',
          function() {
            setTimeout(function() {
              self.runCode(page, code, callback, evaluateFunc);
            }, jsWait);
          });
      } else {

        self.runCode(page, code, callback, evaluateFunc);
      }
    });
  }, waitTime);
};


/**
 * Run code and maybe send result to callback function
 *
 * @param {*} page
 *    Phantom page object
 * @param {Array|Object|Function} code
 *    Function or bunch of function
 * @param {Function} callback
 *    Callback taking args (err, result)
 * @param {Function} evaluateFn
 *    page#evaluate or page#evaluateAsync
 */
BaseScraper.prototype.runCode = function(page, code, callback, evaluateFn) {
  evaluateFn = page.evaluate;

  // one simple function
  if (typeof code === 'function') {
    evaluateFn.call(page, code, callback);

  // object with timeout
  } else if (typeof code === 'object' && !Array.isArray(code)) {
    evaluateFn.call(page, code.code, function(res) {
      setTimeout(function() {
        callback(res);
      }, code.timeout);
    });

  // bunch of functions
  } else if (Array.isArray(code)) {
    var callbacked = false;

    async.forEachSeries(code, function(spec, asyncCallback) {
      var callbackFn
        , codeFn;

      // function + timeout
      if (typeof spec === 'object') {
        codeFn = spec.code;
        callbackFn = function(res) {
          setTimeout(function() {
            asyncCallback();

            if (res && !callbacked) {
              callbacked = true;
              callback(res);
            }

          }, spec.timeout)
        };
        // only function
      } else if (typeof spec === 'function') {
        codeFn = spec;
        callbackFn = function(res) {
          asyncCallback();
          if (res && !callbacked) {
            callbacked = true;
            callback(res);
          }
        };
        // unknown 'code' array
      } else {
        throw new Error('Code spec to run should be function or object');
      }

      evaluateFn.call(page, codeFn, callbackFn);
    }, function(err) {
      if (err) {
        console.error(err);
      }
    });
  // unknown 'code' type
  } else {
    throw new Error('Unknown type of code to evaluate')
  }
};


/**
 * @see {BaseScraper.openAndRun}
 */
BaseScraper.prototype.openAndRunAsync = function(page, url, code, callback) {
  this.openAndRun(page, url, code, callback, true);
};


/**
 * Tries to parse JSON, and executes callback with error if fails
 *
 * @param {string} json
 *    JSON string
 * @param {Function} callback
 *    Callback which accepts at least error if it's thrown
 * @return {*|boolean}
 *    Parsed object or 'false' if JSON.parse failed
 */
BaseScraper.prototype.tryParseJson = function(json, callback) {
  try {
    var data = JSON.parse(json);
    if (!data) {
      throw new Error('No data');
    }
    return data;
  } catch (ex) {
    if (!ex.message) {
      ex.message = '';
    }
    ex.message += '\nSeems that we are blocked or page structure changed';

    callback(ex);
    return null;
  }
};


/**
 * Get list of URLs of pages to be parsed
 *
 * @param {*} page
 *    PhantomJS webpage proxy
 * @param {Function} callback
 *    Callback taking args (err, urls)
 */
BaseScraper.prototype.getItemList = function(page, callback) {
  throw new Error('Not implemented');
};


/**
 * Filter list of URLs
 *
 * @param {Array} urls
 *    Array of URLs to filter
 * @param {Function} callback
 *    Callback taking args (err, filtered)
 */
BaseScraper.prototype.filterList = function(urls, callback) {
  callback(null, urls);
};


/**
 * Parse web page content
 *
 * @param {*} page
 *    PhantomJS webpage proxy
 * @param {String} url
 *    URL of page containing item data
 * @param {Function} callback
 *    Callback taking args (err, data)
 */
BaseScraper.prototype.getItemData = function(page, url, callback) {
  throw new Error('Not implemented');
};


BaseScraper.prototype.getName = function() {
  var code = this.constructor.toString();
  return code.match(/function ([a-z0-9]+)\s*\(/i)[1];
};


BaseScraper.prototype.getLogger = function() {
  if (!this.__logger) {
    var name = this.getName();
    this.__logger = log.getLogger(name);
  }

  return this.__logger;
};


module.exports = BaseScraper;