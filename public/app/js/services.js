'use strict';


angular
  .module('scraper.services', ['ngResource'])
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
  });