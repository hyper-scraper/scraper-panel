'use strict';

var log4js = require('log4js')
  , config = require('../config').log || {};


function getLogger(name) {
  var logger = log4js.getLogger(name);
  if (config.hasOwnProperty(name)) {
    logger.setLevel(config[name]);
  } else {
    logger.setLevel(config.default || 'INFO');
  }
  return logger;
}

module.exports = getLogger;
module.exports.getLogger = getLogger;