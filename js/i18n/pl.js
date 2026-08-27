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
  'catalog.newHabit': 'Nowy nawók',
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
  'catalog.edit.title': 'Edytuj nawók',
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
  'settings.language.label': 'Język wyświetlania',
  'settings.language.en': 'English',
  'settings.language.pl': 'Polski',

  // Settings — Storage card
  'settings.storage.title': 'Pamięć',
  'settings.storage.unsupported': 'Status pamięci niedostępny w tej przeglądarce.',
  'settings.storage.persistent': 'Trwałe',
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
  'settings.install.iosTap': 'Dotkną przycisku Udostępnij, a następnie ',
  'settings.install.iosAdd': 'Dodaj do ekranu głównego',
  'settings.install.iosEnd': '.',
  'settings.install.android': 'Android Chrome',
  'settings.install.androidMenu': 'Otwrz menu, a następnie ',
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
  'settings.mastery.title': 'Opanowanie',
  'settings.mastery.threshold': 'Próg ukończenia',
  'settings.mastery.thresholdAria': 'Próg opanowania %',
  'settings.mastery.pct': '%',
  'settings.mastery.window': 'Okno króczne',
  'settings.mastery.windowAria': 'Okno kroczne opanowania (dni)',
  'settings.mastery.days': 'dni',

  // Settings — Scoring Model card
  'settings.scoring.title': 'Model punktacji',
  'settings.scoring.legend': 'Model punktacji',
  'settings.scoring.s1': 'S1 — Króczny próg',
  'settings.scoring.s2': 'S2 — Ważony dniami',
  'settings.scoring.s3': 'S3 — Dostosowany do obciążenia',

  // Desktop — Analytics
  'desktop.analytics.scoringModel': 'Model punktacji: ',
  'desktop.analytics.habit': 'Nawók',
  'desktop.analytics.mastered': 'Opanowany',
  'desktop.analytics.stage': 'Etap {n}',

  // Desktop — Planning
  'desktop.planning.waveHabit': 'Fala / Nawók',
  'desktop.planning.noUpcoming': 'Brak nadchodzących startów',
  'desktop.planning.scheduleHint': 'Nawyki, które planujesz zacząć w przyszłości, pojawią się tutaj. Zaplanuj je w ',
  'desktop.planning.catalogView': 'Katalogu',
  'desktop.planning.scheduleHintEnd': '.',

  // Desktop — Waveboard
  'desktop.waveboard.habit': 'Nawók',

  // Desktop — WavePlanning
  'desktop.wavePlanning.upcoming': 'Nadchodzący',
  'desktop.wavePlanning.noData': 'Brak danych',
  'desktop.wavePlanning.promoteToActive': 'Aktywuj',
  'desktop.wavePlanning.scheduled': 'Zaplanowane',
  'desktop.wavePlanning.noHabitsInWave': 'Brak nawyków w tej fali.',
};
