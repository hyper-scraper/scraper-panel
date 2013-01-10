'use strict';

var reset = require('./lib/reset').requestNewIdentity;


setInterval(function() {
  reset('127.0.0.1', 9051, function(err){
    if (err) console.error('Error: ' + err.message);
    else console.log('Resetting Tor circuit');
  })
}, 60000);