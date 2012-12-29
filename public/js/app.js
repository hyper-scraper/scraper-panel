'use strict';


angular.module('scraper', ['scraper.filters', 'scraper.services', 'scraper.directives']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/scrapers', {
        templateUrl: 'partials/main.html',
        controller: MainCtrl
      })
      .when('/scrapers/:sId', {
        templateUrl: 'partials/scraper.html',
        controller: ScraperCtrl
      })
      .when('/advertisements', {
        templateUrl: 'partials/advertisements.html',
        controller: AdvertisementsCtrl
      })
      .when('/blocked', {
        templateUrl: 'partials/blocked.html',
        controller: BlockedCtrl
      })
      .when('/executions', {
        templateUrl: 'partials/executions.html',
        controller: ExecutionsCtrl
      })
      .otherwise({
        redirectTo: '/scrapers'
      });
  }]);
