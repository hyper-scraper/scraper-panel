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
  .filter('na', function(i18n) {
    return function(val) {
      if (!!val) {
        return val;
      } else {
        return i18n.t('N/A');
      }
    }
  })
  .filter('fixed', function(i18n) {
    return function(val, length) {
      if (!val) {
        return i18n.t('N/A');
      } else if (val.length < length - 3) {
        return val;
      } else {
        return val.substring(0, length - 3).trim() + '...';
      }
    };
  });
