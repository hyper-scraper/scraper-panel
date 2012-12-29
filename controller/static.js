'use strict';

var handlebars = require('handlebars');


module.exports = function(app) {
  app.get('/', function(req, res) {
    var lang;
    if (req.query.hl) {
      lang = req.query.hl;
    } else {
      lang = 'en';
    }

    res.render('index', {
      lang: lang
    });
  })
};