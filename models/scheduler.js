'use strict';

var EventEmitter = require('events').EventEmitter
  , logger = require('./log')('Scheduler')
  , scrapers = require('./scrapers')
  , util = require('util')
  , config = require('../config').scrapers
  , hooks = null;


try {
  hooks = require('./hooks');
} catch (ex) {
  logger.warn('No hooks available');
}


function copy(src, props) {
  var dest = {}
    , keys = props.split(',')
    , k;

  while (k = keys.shift()) {
    k = k.trim();
    dest[k] = src[k];
  }

  return dest;
}


/**
 * Scheduler for scrapers also an scraping events emitter
 *
 * @param {Array} config
 *    Enabled scraper configurations
 */
function Scheduler(config) {
  EventEmitter.call(this);

  this.config = config;
  this.scheduleScraping();
}
util.inherits(Scheduler, EventEmitter);


Scheduler.prototype.scheduleScraping = function() {
  var config = this.config
    , self = this
    , tasks = {};

  config.forEach(function(conf) {
    var scraper = new (scrapers[conf.type])(conf)
      , spec = {
        status: 'idle',
        sid:    conf.SID,
        last:   null,
        next:   null
      };

    spec.run = function() {
      scraper.run();
    };

    scraper
      .on('execution:start', function() {
        spec.status = 'working';
        spec.message = 'Scraping around...';

        self.emit('exec:start', copy(spec, 'sid,status,last,next,message'));
        hooks && hooks.emit('exec:start', conf);
      })
      .on('execution:error', function(err) {
        spec.status = 'error';
        spec.message = err;
        spec.last = scraper.started;
        spec.next = Date.now() + conf.interval;

        self.emit('exec:error', err, copy(spec, 'sid,status,last,next,message'));
        spec._tm = setTimeout(spec.run, conf.interval);

        hooks && hooks.emit('exec:error', err, conf);
      })
      .on('execution:finished', function(data) {
        spec.status = 'idle';
        spec.message = util.format('Fetched %d records', data.length);
        spec.last = scraper.started;
        spec.next = Date.now() + conf.interval;

        self.emit('exec:finished', copy(spec, 'sid,status,last,next,message'));
        spec._tm = setTimeout(spec.run, conf.interval);

        hooks && hooks.emit('exec:finished', data, conf);
      });

    logger.info(
      'Scheduling %s scraper to run each %dms with timeout: %dms',
      conf.type,
      conf.interval,
      conf.timeout||0
    );

    if (!conf.timeout) {
      spec.run();
      spec.next = Date.now();
    } else {
      setTimeout(spec.run, conf.timeout);
      spec.next = Date.now() + conf.timeout;
    }

    tasks[conf.SID] = spec;
  });

  this.tasks = tasks;
};


Scheduler.prototype.runNow = function(sid) {
  var spec = this.tasks[sid];
  if (spec && spec.status !== 'working') {
    clearTimeout(spec._tm);
    spec.run();
  }
};


module.exports = new Scheduler(config);