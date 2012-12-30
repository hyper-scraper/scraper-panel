'use strict';


/**
 * Main application controller
 *
 * @param $scope
 *    Controller scope
 * @constructor
 */
function MainCtrl($scope, $log) {
   $scope.$on('ajax:loading', function(e, loading) {
     $scope.ajaxLoading = loading;
   });
}




function ScrapersCtrl($scope, ScraperDAO, socket, $notifications, i18n) {
  var self = this;
  $scope.scrapers = ScraperDAO.query(function() {
    self.initSockets($scope, socket);
  });

  $scope.runNow = function(scraper) {
    if (scraper.status === 'working') {
      $notifications.show(i18n.t('Scraper is already working.'));
    } else {
      socket.emit('scheduler:run-now', scraper.id);
    }
  };

  this.getScraper = function(id) {
    var scrapers = $scope.scrapers.filter(function(s) {
      return s.id === id;
    });

    if (!scrapers.length) {
      return null;
    } else {
      return scrapers[0];
    }
  };

  this.setScraperData = function(scraper, spec) {
    scraper.status = spec.status;
    scraper.last_time = spec.last;
    scraper.last_result = spec.message;
    scraper.next_time = spec.next;
  };
}

/**
 * Initiate socket.io listeners
 *
 * @param $scope
 *    Controller scope
 * @param socket
 *    Socket.io Angular service
 */
ScrapersCtrl.prototype.initSockets = function($scope, socket) {
  var self = this;

  socket.emit('scheduler:tasks', {}, function(tasks) {
    $scope.scrapers.forEach(function(scraper) {
      var spec = tasks[scraper.id];
      if (!spec) {
        return;
      }

      self.setScraperData(scraper, spec);
    });
  });

  socket.on('exec:start', function(spec) {
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });

  socket.on('exec:error', function(err, spec) {
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });

  socket.on('exec:finished', function(spec) {
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });
};




/**
 * Scraper view controller
 *
 * @param $scope
 *    Controller scope
 * @param $routeParams
 *    $routeParams instance
 * @param ScraperDAO
 *    Scraper entity
 * @constructor
 */
function ScraperCtrl($scope, $routeParams, ScraperDAO) {
  $scope.scraper = ScraperDAO.get({id: $routeParams.id});
}




/**
 * Base class for controllers working with resources
 *
 * @param $scope
 *    Scope of controller
 * @param DAO
 *    $resource instance
 * @param dataProperty
 *    Property name for collection
 * @constructor
 */
function ResourceCtrl($scope, DAO, dataProperty) {
  dataProperty = dataProperty || 'data';

  this.update = function() {
    $scope.$emit('ajax:loading', true);
    $scope[dataProperty] = DAO.query(function() {
      $scope.$emit('ajax:loading', false);
    });
  };

  this.update();
}




/**
 * Advertisement resource controller
 *
 * @param $scope
 *    Controller scope
 * @param AdvertisementDAO
 *    Advertisement resource model
 * @constructor
 */
function AdvertisementsCtrl($scope, AdvertisementDAO) {
  ResourceCtrl.call(this, $scope, AdvertisementDAO, 'ads');
}
inherits(AdvertisementsCtrl, ResourceCtrl);




/**
 * Advertisement view controller
 *
 * @param $scope
 *    Controller scope
 * @param $routeParams
 *    $routeParams instance
 * @param AdvertisementDAO
 *    Advertisement entity
 * @constructor
 */
function AdvertisementCtrl($scope, $routeParams, AdvertisementDAO) {
  $scope.ad = AdvertisementDAO.get({id: $routeParams.id});
}




/**
 * Blocked resource controller
 *
 * @param $scope
 *    Controller scope
 * @param BlockedDAO
 *    Blocked resource model
 * @constructor
 */
function BlockedCtrl($scope, BlockedDAO) {
  ResourceCtrl.call(this, $scope, BlockedDAO, 'blocked');
}
inherits(ExecutionsCtrl, ResourceCtrl);




/**
 * Execution resource controller
 *
 * @param $scope
 *    Controller scope
 * @param ExecutionDAO
 *    Execution resource model
 * @constructor
 */
function ExecutionsCtrl($scope, ExecutionDAO) {
  ResourceCtrl.call(this, $scope, ExecutionDAO, 'executions');
}
inherits(ExecutionsCtrl, ResourceCtrl);




/**
 * Execution view controller
 *
 * @param $scope
 *    Controller scope
 * @param $routeParams
 *    $routeParams instance
 * @param ExecutionDAO
 *    ExecutionDAO entity
 * @constructor
 */
function ExecutionCtrl($scope, $routeParams, ExecutionDAO) {
  $scope.exec = ExecutionDAO.get({id: $routeParams.id});
}