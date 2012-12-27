'use strict';

module.exports = {
  db:       {
    host:     '85.25.148.30',
    port:     3306,
    database: 'scraper',
    user:     'root',
    password: 'SDvSDSSDf',
    charset:  'utf8',
    verbose:  false
  },
  scrapers: [
    {
      type:       'AvitoScraper',
      SID:        1,
      SEARCH_URL: 'http://www.avito.ru/nizhniy_novgorod/kvartiry?params=201_1060',
      interval:   600000,
      limit:      1
    },

    {
      type:       'AvitoScraper',
      SID:        2,
      SEARCH_URL: 'http://www.avito.ru/nizhniy_novgorod/komnaty?params=200_1055',
      timeout:    180000,
      interval:   600000,
      limit:      1
    },

    {
      type:       'AvitoScraper',
      SID:        3,
      SEARCH_URL: 'http://www.avito.ru/nizhniy_novgorod/doma_dachi_kottedzhi?params=202_1065',
      timeout:    360000,
      interval:   600000,
      limit:      1
    }

  ]
};