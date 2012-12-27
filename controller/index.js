var fs = require('fs')
  , path = require('path');

module.exports = function(app, io) {
  fs.readdir(__dirname, function(err, list) {
    if (err) {
      throw err;
    }

    list.forEach(function(file) {
      if (file === 'index.js') {
        return;
      }

      require('./' + path.basename(file))(app, io);
    });
  });
};