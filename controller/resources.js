'use strict';

var Advertisement = require('../models/db').Advertisement
  , Execution = require('../models/db').Execution
  , Scraper = require('../models/db').Scraper
  , async = require('async');


function setSid(req, res, next) {
  req.sid = parseInt(req.params.id);
  next();
}


function errorOrData(res, next) {
  return function(err, data) {
    if (err) {
      next(err);
    } else {
      res.send(200, data);
    }
  }
}


module.exports = function(app) {
  app.get('/api/scrapers', function(req, res, next) {
    Scraper
      .select('*')
      .order('id ASC')
      .all(errorOrData(res, next));
  });

  app.get('/api/scrapers/:id', setSid, function(req, res, next) {
    Scraper
      .select('id, resource, name')
      .where({id: req.sid})
      .one(function(err, data) {
        if (err) return next(err);
        async.waterfall([
          function(cb) {
            Advertisement
              .select('id, create_time, ad_landlord_name, ad_landlord_phone, ad_landlord_type, ad_id, ad_price, ad_price_type, ad_url, error')
              .where({sid: req.sid})
              .limit('0, 5')
              .order('id DESC')
              .all(cb);
          },
          function(ads, cb) {
            data.advertisements = ads;

            Execution
              .select('id, start_time, finish_time, records, error')
              .where({sid: req.sid})
              .limit('0, 5')
              .order('id DESC')
              .all(cb);
          }
        ], function(err, execs) {
          if (err) return next(err);
          data.executions = execs;
          res.send(200, data);
        })
      });
  });

  app.get('/api/advertisements', function(req, res, next) {
    var page = (parseInt(req.query.page)-1) || 0;
    if (page < 0) page = 0;

    Advertisement
      .select('id, sid, blocked, ad_id, create_time, ad_title, ad_description, ad_price, ad_price_type, ad_city, ad_landlord_name, ad_landlord_type, ad_landlord_phone, ad_url')
      .order('id DESC')
      .page(page, 20)
      .load('scraper', function(s) {
        s.select('scrapers.id as id, scrapers.resource as name');
      })
      .all(errorOrData(res, next));
  });


  app.get('/api/advertisements/count', function(req, res, next) {
    Advertisement
      .select('COUNT(id) as count')
      .one(errorOrData(res, next));
  });

  /*app.get('/api/advertisements/blocked', function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    Advertisement
      .select('id, sid, ad_id, create_time, ad_title, ad_description, ad_price, ad_price_type, ad_city, ad_landlord_name, ad_landlord_type, ad_landlord_phone, ad_url')
      .where({blocked: 1})
      .order('id DESC')
      .page(page, 10)
      .load('scraper', function(s) {
        s.select('scrapers.id as id');
      })
      .all(errorOrData(res, next));
  });*/

  app.get('/api/advertisements/:id', function(req, res, next) {
    Advertisement
      .select('*')
      .where({id: req.params.id})
      .one(function(err, data) {
        if (err) return next(err);

        if (data.ad_picture) {
          data.ad_picture = 'data:image/png;base64,' + data.ad_picture.toString();
        }
        res.send(200, data);
      });
  });

  app.get('/api/executions', function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    if (page < 0) page = 0;

    Execution
      .select('id, sid, start_time, finish_time, records, error')
      .order('id DESC')
      .page(page, 10)
      .all(errorOrData(res, next));
  });

  app.get('/api/executions/:id', function(req, res, next) {
    Execution
      .select('*')
      .where({id: req.params.id})
      .load('advertisements', function(ads) {
        ads.select('id, create_time, ad_landlord_name, ad_landlord_phone, ad_landlord_type, ad_id, ad_price, ad_price_type, ad_url, error')
      })
      .one(errorOrData(res, next));
  });
};