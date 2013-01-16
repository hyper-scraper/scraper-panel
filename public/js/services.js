'use strict';


angular
  .module('scraper.services', ['ngResource', 'i18n'])

  // DAO providers
  .factory('ScraperDAO', function($resource) {
    return $resource('/api/scrapers/:id', {id: '@id'});
  })
  .factory('AdvertisementDAO', function($resource) {
    return $resource('/api/advertisements/:id', {id: '@id'});
  })
  /*.factory('BlockedDAO', function($resource) {
    return $resource('/api/advertisements/blocked/:id', {id: '@id'});
  })*/
  .factory('ExecutionDAO', function($resource) {
    return $resource('api/executions/:id', {id: '@id'});
  })


  .service('socket', function($rootScope) {
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
  .service('i18n', function(_translation) {
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
  .service('$notifications', function($log, i18n) {
    var service = window.webkitNotifications;

    if (!service) {
      $log.warn(i18n.t('Desktop notifications are not supported. :P'));
    }

    this.isSupported = !!service;
    this._check = function() {
      if (!this.isSupported) {
        return false;
      } else if (service.checkPermission()) {
        service.requestPermission();
        return false;
      } else {
        return true;
      }
    };

    this._create = function(title, msg) {
      var n;
      n = service.createNotification('img/logo-64.png', title, msg);
      n.ondisplay = function() {
        setTimeout(function() {
          n.close();
        }, 1000);
      };

      return n;
    };

    this.show = function(msg) {
      if (this._check()) {
        var title = i18n.t('Scraper Panel');
        this._create(title, msg).show();
      }
    };
  });