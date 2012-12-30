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
  })
  .filter('na', function() {
    return function(val) {
      if (!!val) {
        return val;
      } else {
        return 'N/A';
      }
    }
  })
  .filter('fixed', function() {
    return function(val, length) {
      if (!val) {
        return '';
      } else if (val.length < length - 3) {
        return val;
      } else {
        return val.substring(0, length - 3).trim() + '...';
      }
    };
  });
