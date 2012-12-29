'use strict';

var engines = require('consolidate')
  , express = require('express')
  , http = require('http')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , log = require('./models/log')
  , sioLogger = log('socket.io')
  , sioLevel = sioLogger.level
  , io = require('socket.io').listen(server, {
    'logger':    sioLogger,
    'log level': sioLevel
  });

app.configure('development', function() {
  app.set('port', process.env.PORT || 3000);
  app.engine('html', engines.handlebars);
  app.set('view engine', 'html');
  app.set('view cache', true);
  app.set('views', path.join(__dirname, '/public'));
  app.use(express.logger('dev'));
  app.use(express.query());
  app.use(app.router);
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.errorHandler());
});

require('./controller')(app, io);

server.listen(app.get('port'), function() {
  log('express').info('Express server listening on port ' + app.get('port'));
});


// for graceful shutdown
var stopJobs = 0;
process.on('stop:wait', function() {
  stopJobs++;
});

process.on('stop:done', function() {
  if (!--stopJobs) {
    console.log('Shutdown app.');
    process.exit(0);
  }
});