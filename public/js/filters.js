'use strict';


angular
  .module('scraper.filters', ['i18n'])
  .filter('landlord_type', function(i18n) {
    return function(type) {
      if (type === 'agency') {
        return i18n.t('Agency');
      } else if (type === 'private') {
        return i18n.t('Private');
      } else {
        return i18n.t('N/A');
      }
    }
  })
  .filter('i18n', function(i18n) {
    return function(val) {
      return i18n.t(val);
    };
  });
