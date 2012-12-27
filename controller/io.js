'use strict';

var scheduler = require('../models/scheduler');

module.exports = function(app, io) {
  io.sockets.on('connection', function(socket) {
    socket.on('scheduler:run-now', function(sid) {
      scheduler.runNow(sid);
    });

    socket.on('scheduler:tasks', function(data, cb) {
      var tasks = scheduler.tasks
        , sid
        , task
        , out = {};

      for (sid in tasks) {
        if (tasks.hasOwnProperty(sid)) {
          task = tasks[sid];
          out[sid] = {
            status: task.status,
            last: task.last,
            message: task.message,
            next: task.next
          };
        }
      }
      cb(out);
    })
  });

  scheduler.on('exec:start', function(spec) {
    console.log('Something started scraping: ', spec);
    io.sockets.emit('exec:start', spec);
  });

  scheduler.on('exec:error', function(err, spec) {
    console.log('Something had error during scraping: ', err, spec);
    io.sockets.emit('exec:error', err, spec);
  });

  scheduler.on('exec:finished', function(spec) {
    console.log('Something finished scraping: ', spec);
    io.sockets.emit('exec:finished', spec);
  });
};