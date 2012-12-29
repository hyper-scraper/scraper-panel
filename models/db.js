'use strict';

var logger = require('./log')('mapper')
  , Mapper = require('mapper')
  , mysql = require('mapper/node_modules/mysql-libmysqlclient')
  , config = require('../config').db
  , Advertisement
  , Execution
  , Scraper;


Mapper.connect(config, {
  verbose: config.verbose,
  strict: false,
  logger: logger
});

Advertisement = Mapper.map('advertisements');
Execution = Mapper.map('executions');
Scraper = Mapper.map('scrapers');

/**
 * Execution-Advertisement: 1..*
 */
Execution.hasMany('advertisements', Advertisement, 'eid');
Advertisement.belongsTo('execution', Execution, 'eid');

/**
 * Scraper-Advertisement: 1..*
 */
Scraper.hasMany('advertisements', Advertisement, 'sid');
Advertisement.belongsTo('scraper', Scraper, 'sid');

/**
 * Scraper-Execution: 1..*
 */
Scraper.hasMany('executions', Execution, 'sid');
Execution.belongsTo('scraper', Scraper, 'sid');

exports.Advertisement = Advertisement;
exports.Execution = Execution;
exports.Scraper = Scraper;

exports.mapper = Mapper;