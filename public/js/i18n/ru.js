'use strict';

angular
  .module('i18n', [])
  .factory('_translation', function() {
    return {
      'Scraper panel':          'Скрэйпер',
      'Main':                   'Главная',
      'Advertisements':         'Объявления',
      'Blocked advertisements': 'Заблокированные объявления (по номеру)',
      'Blocked':                'Заблокированные',
      'Executions':             'Сессии скрэйперов',
      'Scraper':                'Скрэйпер',
      'Execution':              'Запуск',
      'Original ID':            'ID на сайте',
      'Date':                   'Дата',
      'Title':                  'Заголовок',
      'Description':            'Описание',
      'Price':                  'Цена',
      'Address':                'Адрес',
      'Landlord phone':         'Телефон',
      'Landlord name':          'Имя',
      'Landlord type':          'Тип',

      'Desktop notifications are not supported. :P': 'Уведомления не поддерживаются. :P',
      'Scraper is already working.':                 'Этот скрэйпер уже работает.',

      'Agency':  'Агенство',
      'Private': 'Частное',

      'Scrapers statistics': 'Стастистика скрэйперов',
      'Name':                'Название',
      'Status':              'Статус',
      'Last execution':      'Последний запуск',
      'Last result':         'Последний результат',
      'Next execution':      'Следующий запуск',
      'Actions':             'Действия',
      'Details':             'Подробнее',
      'Run now!':            'Запустить!',

      'Start time': 'Начало',
      'Finish time': 'Конец',
      '# of records': 'Кол-во записей',
      'Fetched records': 'Выбранные объявления',
      'Last 5 advertisements': '5 последних объявлений',
      'Last 5 executions': '5 последних запусков',

      'Scraper #': 'Скрэйпер #',
      'Ad #': 'Объявление #',
      'Execution #': 'Запуск #',
      'Error': 'Ошибка'
    };
  });