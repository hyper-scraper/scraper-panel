'use strict';


function MainCtrl($scope, Scraper, socket) {
  var self = this;
  $scope.scrapers = Scraper.query(function() {
    self.initSockets($scope, socket);
  });

  $scope.runNow = function(scraper) {
    socket.emit('scheduler:run-now', scraper.id);
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

MainCtrl.prototype.initSockets = function($scope, socket) {
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
    console.log(['Started', spec]);
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });

  socket.on('exec:error', function(err, spec) {
    console.log(['Error', err, spec]);
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });

  socket.on('exec:finished', function(spec) {
    console.log(['Finished', spec]);
    var scraper = self.getScraper(spec.sid);
    self.setScraperData(scraper, spec);
  });
};

function ScraperCtrl($scope, $routeParams, Scraper) {
  $scope.scraper = Scraper.get({sId: $routeParams.sId});
}

function AdvertisementsCtrl($scope, Advertisement) {
  $scope.ads = Advertisement.query();
}

function ExecutionsCtrl($scope, Execution) {
  $scope.executions = Execution.query();
}