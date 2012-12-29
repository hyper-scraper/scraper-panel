'use strict';

angular
  .module('i18n', [])
  .factory('_translation', function() {
    return {
      'Scraper panel':  'Скрейпер',
      'Main':           'Главная',
      'Advertisements': 'Объявления',
      'Blocked advertisements': 'Заблокированные объявления (по номеру)',
      'Blocked':        'Заблокированные',
      'Executions':     'Сессии скрейперов',
      'Scraper':        'Скрейпер',
      'Original ID':    'Оригинальный номер объявления',
      'Date':           'Дата',
      'Title':          'Название',
      'Description':    'Описание',
      'Price':          'Цена',
      'Address':        'Адрес',
      'Landlord phone': 'Телефон',
      'Landlord name':  'Имя подавшего',
      'Landlord type':  'Тип подавшего',

      'Desktop notifications are not supported. :P': 'Уведомления не поддерживаются. :P',
      'Scraper is already working.':                 'Этот скрейпер уже работает.',

      'Agency':  'Агенство',
      'Private': 'Частное',

      'Scrapers statistics': 'Стастистика скрейперов',
      'Name':           'Название',
      'Status':         'Статус',
      'Last execution': 'Последний запуск',
      'Last result':    'Результат последнего запуска',
      'Next execution': 'Следующий запуск',
      'Actions':        'Действия',
      'Details': 'Подробнее',
      'Run now!': 'Запустить!'
    };
  });