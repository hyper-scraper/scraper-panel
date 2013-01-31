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




/**
 * Scrapers view controller
 *
 * @param $scope
 *    Controller scope
 * @param ScraperDAO
 *    Scraper resource DAO
 * @param socket
 *    Socket.io Angular service
 * @param $notifications
 *    Webkit notifications Angular service
 * @param i18n
 *    Localization Angular service
 * @constructor
 */
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
 * Base controller for working with resources
 *
 * @param $scope
 *    Scope of controller
 * @param DAO
 *    $resource instance
 * @param dataProperty
 *    Property name for collection
 * @param [page]
 *    View page number
 * @constructor
 */
function PagedResourceCntl($scope, DAO, dataProperty, page) {
  var self = this;
  dataProperty = dataProperty || 'data';
  if (typeof page !== 'number') {
    page = (parseInt(page, 10) - 1) || 0;
  }

  this.update = function() {
    if (this.loading) return;
    this.loading = true;

    $scope.page = page;
    $scope.$emit('ajax:loading', true);
    $scope[dataProperty] = DAO.query({page: page + 1}, function() {
      $scope.$emit('ajax:loading', false);
      self.loading = false;
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
 * @param $routeParams
 *    Hash with current route params
 * @param $http
 *    HTTP service
 * @param $location
 *    Location service
 * @param socket
 *    Socket.io Angular service
 * @constructor
 * @extends {PagedResourceCntl}
 */
function AdvertisementsCtrl($scope, AdvertisementDAO, $routeParams, $http, $location, socket) {
  PagedResourceCntl.call(this, $scope, AdvertisementDAO, 'ads', $routeParams.page);
  var self = this;


  this.updatePager = function() {
    $http
      .get('/api/advertisements/count')
      .success(function(data) {

        var count = Math.ceil(data.count / 20)
          , showPages = 9
          , offset = 4
          , start = $scope.page - offset
          , i = 0
          , pages = [];
        if (count < showPages) {
          start = 0;
          showPages = count;
        } else if (start < 0) {
          start = 0;
        } else if ($scope.page + offset > count - 1) {
          start = count - showPages;
        }

        while (i < showPages) {
          pages.push(i++ + start);
        }

        $scope.count = count;
        $scope.pages = pages;
      });
  };

  $scope.classAdvertisement = function(ad) {
    return ad.blocked
      ? 'error'
      : '';
  };

  $scope.classPage = function(page) {
    return ($scope.page === page)
      ? 'active'
      : '';
  };

  $scope.moveToPageBy = function(offset) {
    var page = $scope.page
      , count = $scope.count
      , newPage = page + offset;

    if (newPage >= 0 && newPage <= count - 1) {
      $location.path('/advertisements/page/' + (newPage + 1));
    }
  };

  socket.on('exec:finished', function() {
    self.update();
  });

  this.updatePager();
}
inherits(AdvertisementsCtrl, PagedResourceCntl);




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
/*function BlockedCtrl($scope, BlockedDAO) {
 ResourceCtrl.call(this, $scope, BlockedDAO, 'blocked');
 }
 inherits(ExecutionsCtrl, ResourceCtrl);*/




/**
 * Execution resource controller
 *
 * @param $scope
 *    Controller scope
 * @param ExecutionDAO
 *    Execution resource model
 * @constructor
 * @extends {PagedResourceCntl}
 */
function ExecutionsCtrl($scope, ExecutionDAO) {
  PagedResourceCntl.call(this, $scope, ExecutionDAO, 'executions');
}
inherits(ExecutionsCtrl, PagedResourceCntl);




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