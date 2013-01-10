'use strict';

var phantom = require('phantom-proxy');


module.exports = function(app) {
  app.get('/test/my-ip', function(req, res) {
    res.set('Content-type', 'image/png');
    phantom.create({proxy: '127.0.0.1:9050', proxyType: 'socks5'}, function(proxy) {
     proxy.page.open('http://whatismyip.org/ipimg.php', function(result) {
       proxy.page.set('clipRect', {top: 0, left: 0, width: 108, height: 15}, function() {
         proxy.page.renderBase64('png', function(imageData) {
           var buf = new Buffer(imageData, 'base64');
           res.send(buf);
         });
         proxy.end();
       });
     });
    });
  });
};