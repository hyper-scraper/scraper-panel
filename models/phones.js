'use strict';

var fs = require('fs')
  , http = require('http')
  , mkdirp = require('mkdirp')
  , moment = require('moment')
  , path = require('path')
  , logger = require('./log')('PhoneService');


/**
 * Model which does all the telephone related stuff
 *
 * @constructor
 */
function PhonesService() {
}


/**
 * Run OCR analysis
 *
 * @param {Buffer} imageBuffer
 *    Image data
 * @param {*} query
 *    Query string of HTTP request to OCR service
 * @param {*} body
 *    JSON body of HTTP request to OCR service
 * @param {Function} callback
 *    Callback taking (err, result)
 */
PhonesService.prototype.OCR = function(imageBuffer, query, body, callback) {
  var self = this;

  query = query || '';

  body = body || {type: 'png', lang: 'eng'};
  body.image = imageBuffer.toString('base64');

  this._httpRequest(
    {
      hostname: 'liberitas.info',
      port:     3001,
      path:     '/run-ocr?' + query,
      method:   'POST',
      headers:  {
        'Content-type': 'application/json'
      }
    },

    body,

    function(err, res) {
      if (err) {
        callback(err);

      } else {
        var phone = res.result;
        phone = phone.replace(/[^0-9,]/g, '');

        if (!phone) {
          self.saveNotIdentified(imageBuffer, body.type);
        }
        if (phone.indexOf(',') !== -1) {
          phone = phone.split(',');
        }

        callback(null, phone);
      }
    }
  );
};


/**
 * Check if phone number is in blacklist
 *
 * @param {String|Array} phoneNumber
 *    Phone number or array with numbers
 * @param {Function} callback
 *    Function taking (err, isBlocked)
 */
PhonesService.prototype.isBlocked = function(phoneNumber, callback) {
  var query;
  if (Array.isArray(phoneNumber)) {
    query = phoneNumber;
  } else {
    query = [phoneNumber];
  }

  this._httpRequest(
    {
      hostname: '85.25.148.30',
      port:     3000,
      path:     '/query',
      method:   'POST',
      headers:  {
        'Content-type': 'application/json'
      }
    },

    query,

    function(err, res) {
      if (err) {
        callback(err);

      } else if (!Array.isArray(res)) {
        err = new Error(
          'Bad answer from blacklist checker application: %s',
          JSON.stringify(res)
        );
        callback(err);

      } else {
        var blocked = query.some(function(phone) {
          var isBlocked = (res.indexOf(phone) !== -1);
          if (isBlocked) {
            logger.debug('Phone(s) %s is in blacklist', phone);
          }
          return isBlocked;
        });

        callback(null, blocked);
      }
    }
  );
};


/**
 * Save image of phone which was not identified properly
 *
 * @param {Buffer} buf
 *    Buffer with image data
 * @param {String} type
 *    Image type (also file extension)
 */
PhonesService.prototype.saveNotIdentified = function(buf, type) {
  var dir = path.join(__dirname, '../data/', 'ocr-failed')
    , now = moment.utc()
    , fileName = [now.format('YYYY-MM-DD-HH-mm-ss'), type].join('.')
    , filePath = path.join(dir, fileName);

  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
  }

  fs.writeFileSync(filePath, buf);
  logger.info(
    'Saved image with not identified phone number to: %s',
    path.relative(process.cwd(), filePath)
  );
};


/**
 * HTTP request helper
 *
 * @param {*} options
 *    Options passed to http.request()
 * @param {*} data
 *    Data passed as JSON in HTTP request body
 * @param {Function} callback
 *    Function taking (err, response)
 * @private
 */
PhonesService.prototype._httpRequest = function(options, data, callback) {
  var body
    , req;

  if (data) {
    body = JSON.stringify(data);
  } else {
    body = '';
  }

  req = http.request(options, function(res) {
    var json = '';

    res.setEncoding('utf8');

    res.on('data', function(data) {
      json += data;
    });

    res.on('end', function() {
      var response = JSON.parse(json);
      callback(null, response);
    });

  });

  req.once('error', function(err) {
    callback(err);
  });

  req.end(body);
};


module.exports = new PhonesService();