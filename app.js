'use strict';

var express = require('express')
  , http = require('http')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

app.configure('development', function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(app.router);
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

require('./controller')(app, io);

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});