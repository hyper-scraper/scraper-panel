'use strict';


angular.module('scraper', ['scraper.filters', 'scraper.services', 'scraper.directives']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider
      .when('/scrapers', {
        templateUrl: 'partials/main.html',
        controller: ScrapersCtrl
      })
      .when('/scrapers/:id', {
        templateUrl: 'partials/scraper.html',
        controller: ScraperCtrl
      })
      .when('/advertisements', {
        templateUrl: 'partials/advertisements.html',
        controller: AdvertisementsCtrl
      })
      .when('/advertisements/page/:page', {
        templateUrl: 'partials/advertisements.html',
        controller: AdvertisementsCtrl
      })
      .when('/advertisements/:id', {
        templateUrl: 'partials/ad.html',
        controller: AdvertisementCtrl
      })
      /*.when('/blocked', {
        templateUrl: 'partials/blocked.html',
        controller: BlockedCtrl
      })*/
      .when('/executions', {
        templateUrl: 'partials/executions.html',
        controller: ExecutionsCtrl
      })
      .when('/executions/:id', {
        templateUrl: 'partials/exec.html',
        controller: ExecutionCtrl
      })
      .otherwise({
        redirectTo: '/scrapers'
      });
  }]);
