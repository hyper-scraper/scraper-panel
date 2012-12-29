'use strict';

var EventEmitter = require('events').EventEmitter
  , logger = require('./log')('Scheduler')
  , scrapers = require('./scrapers')
  , util = require('util')
  , config = require('../config').scrapers;


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
        spec.next = null;

        self.emit('exec:start', spec);
      })
      .on('execution:error', function(err) {
        spec.status = 'error';
        spec.message = err;
        spec.last = scraper.started;
        spec.next = Date.now() + conf.interval;

        self.emit('exec:error', err, spec);
        spec._tm = setTimeout(spec.run, conf.interval);
      })
      .on('execution:finished', function(data) {
        spec.status = 'idle';
        spec.message = util.format('Fetched %d records', data.length);
        spec.last = scraper.started;
        spec.next = Date.now() + conf.interval;

        self.emit('exec:finished', spec);
        spec._tm = setTimeout(spec.run, conf.interval);
      });

    logger.info(
      'Scheduling %s scraper to run each %dms with timeout: %dms',
      conf.type,
      conf.interval,
      conf.timeout||0
    );

    if (!conf.timeout) {
      spec.run();
    } else {
      spec.next = Date.now() + conf.timeout;
      setTimeout(spec.run, conf.timeout);
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