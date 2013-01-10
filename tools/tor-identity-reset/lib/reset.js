/**
 * Created with IntelliJ IDEA.
 * User: Alexander <estliberitas> Makarenko
 * Date: 04.01.13
 * Time: 3:25
 */
'use strict';

var fs = require('fs')
  , net = require('net')
  , q = require('q')
  , util = require('util')
  , cookiePath = process.argv[2] || '/var/run/tor/control.authcookie'
  , cookie = fs.readFileSync(cookiePath).toString('hex');


/**
 * Request tor get new identity, i.e. reset circuit
 *
 * @param {String} host
 *    Hostname of Tor control service
 * @param {String|Number} port
 *    Tor control port
 * @param {String} [auth]
 *    Auth cookie (optional)
 * @param {Function} callback
 *    Callback taking result (err)
 */
function new_identity(host, port, auth, callback) {
  if (typeof auth === 'function') {
    callback = auth;
    auth = null;
  }

  var sock = new net.Socket({ allowHalfOpen: false });
  connect(sock, port, host)
    .then(function() {
      return write(sock, util.format('AUTHENTICATE %s', auth));
    })
    .then(function() {
      return write(sock, 'signal NEWNYM');
    })
    .then(function() {
      sock.destroy();
      callback();
    })
    .fail(function(err) {
      sock.destroy();
      callback(err);
    });
}


/**
 * Write data to socket in promise-style
 *
 * @param {net.Socket} sock
 *    Socket object
 * @param {String} cmd
 *    Command to execute
 * @return {promise}
 *    Promise object
 */
function write(sock, cmd) {
  var deferred = q.defer();
  if (!sock.writable) {
    process.nextTick(function() {
      deferred.reject(new Error('Socket is not writable'));
    });
    return deferred.promise;
  }

  sock.removeAllListeners('error');
  sock.removeAllListeners('data');

  sock.once('data', function(data) {
    var res = data.toString().replace(/[\r\n]/g, '')
      , tokens = res.split(' ')
      , code = parseInt(tokens[0]);

    if (code !== 250) {
      deferred.reject(new Error(res));
    } else {
      deferred.resolve();
    }
  });

  sock.once('err', deferred.reject);
  sock.write(cmd + '\r\n');
  return deferred.promise;
}


/**
 * Connect to Tor control service in promise-style
 *
 * @param {net.Socket} sock
 *    Socket object
 * @param {String|Number} port
 *    Tor control port
 * @param host
 *    Tor control host
 * @return {promise}
 *    Promise object
 */
function connect(sock, port, host) {
  var deferred = q.defer();
  sock.once('connect', deferred.resolve);
  sock.once('error', deferred.reject);
  sock.connect(port, host);
  return deferred.promise;
}


exports.requestNewIdentity = function(host, port, callback) {
  new_identity(host, port, cookie, callback);
};


if (process.argv[1].indexOf('reset.js') !== -1) {
  exports.requestNewIdentity('127.0.0.1', 9051, function(err) {
    if (err) {
      console.error(err);
    } else {
      console.log('Resetting');
    }
  });
}
