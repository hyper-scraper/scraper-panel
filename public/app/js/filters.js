'use strict';

/* Filters */

angular
  .module('scraper.filters', [])
  .filter('landlord_type', function() {
    return function(type) {
      if (type === 'agency') {
        return 'Агенство';
      } else if (type === 'private') {
        return 'Частник';
      } else {
        return 'N/A';
      }
    }
  });
