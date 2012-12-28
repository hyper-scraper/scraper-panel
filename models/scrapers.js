var fs = require('fs')
  , path = require('path')
  , dir = path.join(__dirname, 'scrapers')
  , BaseScraper = require('./base-scraper').BaseScraper
  , list;

exports.BaseScraper = BaseScraper;

list = fs.readdirSync(dir);
list.forEach(function(file) {
  if (file === 'index.js') {
    return;
  }

  //noinspection UnnecessaryLocalVariableJS
  var scraper = require('./scrapers/' + path.basename(file))
    , name = scraper.toString().match(/function ([a-z0-9]+)\s*\(/i)[1];

  exports[name] = scraper;
});
