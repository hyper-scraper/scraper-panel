'use strict';


angular
  .module('scraper.services', ['ngResource', 'i18n'])
  .factory('Scraper', function($resource) {
    return $resource(
      '/api/scrapers/:sId',
      {
        sId: '@id'
      }
    );
  })
  .factory('Advertisement', function($resource) {
    return $resource(
      '/api/advertisements/:aId',
      {
        aId: '@id'
      }
    );
  })
  .factory('Blocked', function($resource) {
    return $resource(
      '/api/advertisements/blocked/:bId',
      {
        bId: '@id'
      }
    );
  })
  .factory('Execution', function($resource) {
    return $resource(
      '/api/executions/:eId',
      {
        eId: '@id'
      }
    );
  })
  .factory('socket', function($rootScope) {
    var socket = io.connect();
    return {
      on:   function(eventName, callback) {
        socket.on(eventName, function() {
          var args = arguments;
          $rootScope.$apply(function() {
            callback.apply(socket, args);
          });
        });
      },
      emit: function(eventName, data, callback) {
        socket.emit(eventName, data, function() {
          var args = arguments;
          $rootScope.$apply(function() {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        })
      }
    };
  })
  .factory('i18n', function(_translation) {
    return {
      t: function(str) {
        if (_translation.hasOwnProperty(str)) {
          return _translation[str];
        } else {
          return str;
        }
      }
    }
  })
  .factory('$notifications', function($log, i18n) {
    return {
      showNotification: function(msg) {
        var notifications = window.webkitNotifications;
        if (!notifications) {
          $log.warn(i18n.t('Desktop notifications are not supported. :P'));
        } else if (notifications.checkPermission()) {
          notifications.requestPermission();
        } else {
          var notification = notifications.createNotification(
            'img/logo-64.png',
            i18n.t('Scraper Panel'),
            msg
          );

          notification.show();
          setTimeout(function() {
            notification.close();
          }, 1000);
        }
      }
    };
  });