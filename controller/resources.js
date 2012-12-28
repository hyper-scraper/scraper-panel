'use strict';

var Advertisement = require('../models/db').Advertisement
  , Execution = require('../models/db').Execution
  , Scraper = require('../models/db').Scraper;


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
       .select('*')
       .where({id: req.sid})
       .load('advertisements', function(a) {
         a
           .select('create_time, ad_title, ad_landlord_phone, ad_id, ad_city, ad_price, ad_url')
           .order('id DESC')
           .page(0, 5);
       })
       .load('executions', function(e) {
         e
           .select('start_time, finish_time, records')
           .order('id DESC')
           .page(0, 5);
       })
       .one(errorOrData(res, next));
  });

  app.get('/api/scrapers/:id/executions', setSid, function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    Execution
      .where({sid: req.sid})
      .order('id DESC')
      .page(page, 5)
      .all(errorOrData(res, next));
  });

  app.get('/api/scrapers/:id/executions/count', setSid, function(req, res, next) {
    Execution
      .select('COUNT(*) AS count')
      .where({sid: req.sid})
      .all(function(err, data) {
        if (err) {
          next(err);
        } else {
          res.send(200, data[0]);
        }
      });
  });

  app.get('/api/scrapers/:id/advertisements', setSid, function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    Advertisement
      .select('*')
      .where({sid: req.sid})
      .order('id DESC')
      .page(page, 10)
      .all(errorOrData(res, next));
  });

  app.get('/api/scrapers/:id/advertisements/count', setSid, function(req, res, next) {
    Advertisement
      .select('COUNT(*) AS count')
      .where({sid: req.sid})
      .all(function(err, data) {
        if (err) {
          next(err);
        } else {
          res.send(200, data[0]);
        }
      });
  });

  app.get('/api/advertisements', function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    Advertisement
      .select('id, ad_id, create_time, ad_title, ad_description, ad_price, ad_price_type, ad_city, ad_landlord_name, ad_landlord_type, ad_landlord_phone, ad_url')
      .order('id DESC')
      .page(page, 10)
      .load('scraper', function(s) {
        s.select('name');
      })
      .all(errorOrData(res, next));
  });

  app.get('/api/executions', function(req, res, next) {
    var page = parseInt(req.params.page) || 0;
    Execution
      .select('*')
      .order('id DESC')
      .page(page, 10)
      .all(errorOrData(res, next));
  });
};