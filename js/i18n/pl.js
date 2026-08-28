/**
 * @file Polish locale dictionary for the Nawyki i18n module. Mirrors every key
 * in en.js with Polish equivalents. Any untranslated key falls back to English
 * in t(). Keys use the same dot-notation namespace as en.js.
 */

/** @type {Record<string, string>} */
export const PL = {
  // Navigation
  'nav.today': 'dziś',
  'nav.history': 'historia',
  'nav.catalog': 'katalog',
  'nav.settings': 'ustawienia',

  // Today view
  'today.title': 'Nawyki',
  'today.empty': 'Brak nawyków na dziś.',
  'today.allDone': 'Wszystko gotowe — do jutra!',
  'today.count': '{done} z {total}',
  'today.showPolish': 'Pokaż oryginalną nazwę',
  'today.phaseTooltip': 'Coming in Phase 4',

  // Catalog view
  'catalog.title': 'Katalog',
  'catalog.newHabit': 'Nowy nawyk',
  'catalog.wave': 'Fala {n}',
  'catalog.status.active': 'aktywny',
  'catalog.status.mastered': 'opanowany',
  'catalog.status.archived': 'archiwalny',
  'catalog.status.scheduled': 'zaplanowany',
  'catalog.mastered': 'Opanowany',
  'catalog.stage': 'Etap {n}',
  'catalog.edit': 'Edytuj',
  'catalog.restore': 'Przywróć',
  'catalog.archive': 'Archiwizuj',
  'catalog.advanceStage': 'Następny etap',
  'catalog.promote': 'Aktywuj',
  'catalog.edit.title': 'Edytuj nawyk',
  'catalog.edit.name': 'Nazwa',
  'catalog.edit.namePl': 'Polska nazwa (opcjonalnie)',
  'catalog.edit.wave': 'Fala',
  'catalog.edit.cadenceType': 'Typ częstotliwości',
  'catalog.edit.targetType': 'Typ celu',
  'catalog.edit.targetCount': 'Liczba celów',
  'catalog.edit.startDate': 'Data startu',
  'catalog.edit.stages': 'Etapy',
  'catalog.edit.addStage': 'Dodaj etap',
  'catalog.edit.customMastery': 'Indywidualne opanowanie',
  'catalog.edit.overrideGlobal': 'Nadrzędne globalne ustawienia opanowania',
  'catalog.edit.threshold': 'Próg (%)',
  'catalog.edit.window': 'Okno (dni)',

  // History view
  'history.prev': '←',
  'history.next': '→',
  'history.jumpToDate': 'Przejdź do daty ▼',
  'history.toggle': 'Przełącz',
  'history.markAllNotCompleted': 'Oznacz wszystkie jako niewykonane',

  // Settings — Language card
  'settings.language.title': 'Język',
  'settings.language.label': 'Język wyświetlania: ',
  'settings.language.en': 'English',
  'settings.language.pl': 'Polski',

  // Settings — Storage card
  'settings.storage.title': 'Pamięć',
  'settings.storage.unsupported': 'Status pamięci niedostępny w tej przeglądarce.',
  'settings.storage.persistent': 'Trwała',
  'settings.storage.loading': 'ładowanie…',
  'settings.storage.yes': 'tak',
  'settings.storage.no': 'nie',
  'settings.storage.requestPersistence': 'Zażądaj trwałości',
  'settings.storage.storageRow': 'Pamięć',
  'settings.storage.using': 'Używasz {usedMB} MB z ~{quotaMB} MB',

  // Settings — Schedule card
  'settings.schedule.title': 'Harmonogram',
  'settings.schedule.weekStartsOn': 'Tydzień zaczyna się od',
  'settings.schedule.monday': 'Poniedziałek',
  'settings.schedule.sunday': 'Niedziela',

  // Settings — Install card
  'settings.install.title': 'Instalacja',
  'settings.install.ios': 'iOS Safari',
  'settings.install.iosTap': 'Dotknij przycisku Udostępnij, a następnie ',
  'settings.install.iosAdd': 'Dodaj do ekranu głównego',
  'settings.install.iosEnd': '.',
  'settings.install.android': 'Android Chrome',
  'settings.install.androidMenu': 'Otwórz menu, a następnie ',
  'settings.install.androidInstall': 'Zainstaluj aplikację',
  'settings.install.androidEnd': '.',
  'settings.install.desktop': 'Przeglądarki na komputerze',
  'settings.install.desktopInfo': 'Sprawdź ikonę instalacji w pasku adresu lub użyj menu przeglądarki.',

  // Settings — Data card
  'settings.data.title': 'Dane',
  'settings.data.lastBackup': 'Ostatnia kopia',
  'settings.data.exportJson': 'Eksportuj JSON',
  'settings.data.exportCsv': 'Eksportuj CSV',
  'settings.data.recomputing': 'Przeliczanie…',
  'settings.data.recomputeScores': 'Przelicz wyniki',
  'settings.data.undoBtn': 'Cofnij ostatnią akcję',
  'settings.data.nothingToUndo': 'Nie ma czego cofać.',
  'settings.data.last': 'Ostatnio: {event} · {relativeTime}',
  'settings.data.resetData': 'Resetuj dane',
  'settings.data.resetWarning': 'To usunie wszystkie dane zapisane na tym urządzeniu.',

  // Settings — About card
  'settings.about.title': 'O aplikacji',
  'settings.about.appVersion': 'Wersja aplikacji',
  'settings.about.schemaVersion': 'Wersja schematu',
  'settings.about.cacheName': 'Nazwa cache',
  'settings.about.serviceWorker': 'Service worker',

  // Settings — Mastery card
  'settings.mastery.title': 'Poziom opanowania',
  'settings.mastery.threshold': 'Próg zaliczenia',
  'settings.mastery.thresholdAria': 'Próg zaliczenia %',
  'settings.mastery.pct': '%',
  'settings.mastery.window': 'Okres kroczący',
  'settings.mastery.windowAria': 'Okres kroczący opanowania (dni)',
  'settings.mastery.days': 'dni',

  // Settings — Scoring Model card
  'settings.scoring.title': 'Model punktacji',
  'settings.scoring.legend': 'Model punktacji',
  'settings.scoring.s1': 'S1 — Próg dynamiczny',
  'settings.scoring.s2': 'S2 — Ważony liczbą dni',
  'settings.scoring.s3': 'S3 — Skorygowany względem obciążenia',

  // Desktop — Analytics
  'desktop.analytics.scoringModel': 'Model punktacji: ',
  'desktop.analytics.habit': 'Nawyk',
  'desktop.analytics.mastered': 'Opanowany',
  'desktop.analytics.stage': 'Etap {n}',

  // Desktop — Planning
  'desktop.planning.waveHabit': 'Fala / Nawyk',
  'desktop.planning.noUpcoming': 'Brak nadchodzących startów',
  'desktop.planning.scheduleHint': 'Nawyki, które planujesz zacząć w przyszłości, pojawią się tutaj. Zaplanuj je w ',
  'desktop.planning.catalogView': 'Katalogu',
  'desktop.planning.scheduleHintEnd': '.',

  // Desktop — Waveboard
  'desktop.waveboard.habit': 'Nawyk',

  // Desktop — WavePlanning
  'desktop.wavePlanning.upcoming': 'Nadchodzący',
  'desktop.wavePlanning.noData': 'Brak danych',
  'desktop.wavePlanning.promoteToActive': 'Aktywuj',
  'desktop.wavePlanning.scheduled': 'Zaplanowane',
  'desktop.wavePlanning.noHabitsInWave': 'Brak nawyków w tej fali.',

  // Util — relative time
  'util.justNow': 'przed chwilą',
  'util.minutesAgo': '{n} min. temu',
  'util.hoursAgo': '{n} godz. temu',
  'util.daysAgo': '{n} dni temu',

  // History — extra
  'history.noHabits': 'Brak nawyków na ten dzień.',
  'history.slots': 'poz.',

  // Today — extra
  'today.slots': 'poz.',

  // Catalog — cadence type options
  'catalog.cadence.daily': 'Codziennie',
  'catalog.cadence.weekly': 'Tygodniowo',
  'catalog.cadence.monthly': 'Miesięcznie',
  'catalog.cadence.everyNDays': 'Co N dni',
  'catalog.cadence.specificDays': 'Wybrane dni',

  // Catalog — target type options
  'catalog.targetType.binary': 'Binarne (tak/nie)',
  'catalog.targetType.numeric': 'Liczba (ilość)',
  'catalog.targetType.slotChecklist': 'Lista pozycji',

  // Catalog — panel actions
  'catalog.save': 'Zapisz',
  'catalog.cancel': 'Anuluj',
  'catalog.stagePlaceholder': 'Nazwa etapu',

  // Settings — Data card extra strings
  'settings.data.never': 'Nigdy',
  'settings.data.backupDaysAgo': '{n} dni temu',
  'settings.data.nagNoBackup': 'Nie znaleziono kopii. Wyeksportuj dane.',
  'settings.data.nagDaysAgo': 'Ostatnia kopia: {n} dni temu. Wyeksportuj dane.',

  // Page headings (static HTML)
  'page.settings': 'Ustawienia',
  'page.history': 'Historia',

  // Desktop shell
  'desktop.title': 'Analityka nawyków',
  'desktop.nav.analytics': 'Analityka',
  'desktop.nav.waveboard': 'Tablica fal',
  'desktop.nav.planning': 'Planowanie',
  'desktop.nav.settings': 'Ustawienia',
  'desktop.wavePlanning.title': 'Planowanie fal',

  // Settings — Data card
  'settings.data.openDesktop': 'Otwórz analitykę →',

  // Settings — Storage card (dynamic text)
  'settings.storage.unknown': 'nieznany',

  // Settings — About card (dynamic text)
  'settings.about.na': 'n/d',
  'settings.about.none': 'brak',
  'settings.about.unsupported': 'nieobsługiwane',
  'settings.about.swControlled': 'aktywny',
  'settings.about.swRegistered': 'zarejestrowany',

  // Util — singular relative time
  'util.minuteAgo': '1 minutę temu',
  'util.hourAgo': '1 godzinę temu',
  'util.dayAgo': '1 dzień temu',

  // Analytics table column headers
  'desktop.analytics.stageCol': 'Etap',
  'desktop.analytics.rollingPctCol': 'Krocząco %',
  'desktop.analytics.masteryCol': 'Opanowanie',
  'desktop.analytics.modelScore': 'Wynik {model}',

  // Shared desktop S1 status badge names
  'desktop.status.healthy': 'Zdrowy',
  'desktop.status.watch': 'Obserwacja',
  'desktop.status.atRisk': 'Zagrożony',
  'desktop.status.failing': 'Krytyczny',

  // Show archived toggle
  'desktop.showArchived': 'Pokaż archiwalne',

  // Waveboard
  'desktop.waveboard.scoreMatrix': 'Macierz wyników',
  'desktop.waveboard.notApplicable': 'Nie dotyczy',
  'desktop.waveboard.cellTitle': '{status} ({completed}/{applicable} dni)',
  'desktop.waveboard.gracePeriod': 'Okres wdrożenia',

  // Wave Planning
  'desktop.wavePlanning.countsText': '{active} aktywne · {scheduled} zaplanowane',
  'desktop.wavePlanning.promoteFailed': 'Błąd — spróbuj ponownie',

  // Cadence summary with actual count
  'catalog.cadence.everyNDaysCount': 'Co {n} dni',

  // Analytics — avg abbreviation
  'desktop.analytics.avg': 'śr.',

  // Settings — last event descriptions
  'settings.data.markedComplete': 'oznaczono {name} jako wykonane',
  'settings.data.markedUncomplete': 'oznaczono {name} jako niewykonane',
  'settings.data.changedSetting': 'zmieniono {key} na {value}',
  'settings.data.unknownHabit': '(nawyk)',

  // Settings — custom file import button
  'settings.data.chooseFile': 'Wybierz plik',
  'settings.data.noFileChosen': 'Nie wybrano pliku',
};
