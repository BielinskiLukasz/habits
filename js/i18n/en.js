/**
 * @file English locale dictionary for the Nawyki i18n module. All user-visible
 * strings for every view builder and the Settings language card. Keys use
 * dot-notation namespaced by view (nav, today, catalog, history, settings,
 * desktop). Values are plain strings; {placeholder} syntax marks interpolation
 * points substituted by t() at call time.
 */

/** @type {Record<string, string>} */
export const EN = {
  // Navigation
  'nav.today': 'today',
  'nav.history': 'history',
  'nav.catalog': 'catalog',
  'nav.settings': 'settings',

  // Today view
  'today.title': 'Habits',
  'today.empty': 'No habits scheduled today.',
  'today.allDone': 'All done today — see you tomorrow.',
  'today.count': '{done} of {total}',
  'today.showPolish': 'Show original Polish name',
  'today.phaseTooltip': 'Coming in Phase 4',

  // Catalog view
  'catalog.title': 'Catalog',
  'catalog.newHabit': 'New habit',
  'catalog.wave': 'Wave {n}',
  'catalog.status.active': 'active',
  'catalog.status.mastered': 'mastered',
  'catalog.status.archived': 'archived',
  'catalog.status.scheduled': 'scheduled',
  'catalog.mastered': 'Mastered',
  'catalog.stage': 'Stage {n}',
  'catalog.edit': 'Edit',
  'catalog.restore': 'Restore',
  'catalog.archive': 'Archive',
  'catalog.advanceStage': 'Advance stage',
  'catalog.promote': 'Promote',
  'catalog.edit.title': 'Edit habit',
  'catalog.edit.name': 'Name',
  'catalog.edit.namePl': 'Polish name (optional)',
  'catalog.edit.wave': 'Wave',
  'catalog.edit.cadenceType': 'Cadence type',
  'catalog.edit.targetType': 'Target type',
  'catalog.edit.targetCount': 'Target count',
  'catalog.edit.startDate': 'Start date',
  'catalog.edit.stages': 'Stages',
  'catalog.edit.addStage': 'Add stage',
  'catalog.edit.customMastery': 'Custom mastery',
  'catalog.edit.overrideGlobal': 'Override global mastery settings',
  'catalog.edit.threshold': 'Threshold (%)',
  'catalog.edit.window': 'Window (days)',

  // History view
  'history.prev': '←',
  'history.next': '→',
  'history.jumpToDate': 'Jump to date ▼',
  'history.toggle': 'Toggle',
  'history.markAllNotCompleted': 'Mark all not-completed',

  // Settings — Language card
  'settings.language.title': 'Language',
  'settings.language.label': 'Display language',
  'settings.language.en': 'English',
  'settings.language.pl': 'Polski',

  // Settings — Storage card
  'settings.storage.title': 'Storage',
  'settings.storage.unsupported': 'Storage status unsupported on this browser.',
  'settings.storage.persistent': 'Persistent',
  'settings.storage.loading': 'loading…',
  'settings.storage.yes': 'yes',
  'settings.storage.no': 'no',
  'settings.storage.requestPersistence': 'Request persistence',
  'settings.storage.storageRow': 'Storage',
  'settings.storage.using': 'Using {usedMB} MB of ~{quotaMB} MB',

  // Settings — Schedule card
  'settings.schedule.title': 'Schedule',
  'settings.schedule.weekStartsOn': 'Week starts on',
  'settings.schedule.monday': 'Monday',
  'settings.schedule.sunday': 'Sunday',

  // Settings — Install card
  'settings.install.title': 'Install',
  'settings.install.ios': 'iOS Safari',
  'settings.install.iosTap': 'Tap the Share button, then ',
  'settings.install.iosAdd': 'Add to Home Screen',
  'settings.install.iosEnd': '.',
  'settings.install.android': 'Android Chrome',
  'settings.install.androidMenu': 'Open the menu, then ',
  'settings.install.androidInstall': 'Install app',
  'settings.install.androidEnd': '.',
  'settings.install.desktop': 'Desktop browsers',
  'settings.install.desktopInfo': 'Look for the install icon in the URL bar, or use the browser menu.',

  // Settings — Data card
  'settings.data.title': 'Data',
  'settings.data.lastBackup': 'Last backup',
  'settings.data.exportJson': 'Export JSON',
  'settings.data.exportCsv': 'Export CSV',
  'settings.data.recomputing': 'Recomputing…',
  'settings.data.recomputeScores': 'Recompute Scores',
  'settings.data.undoBtn': 'Undo last action',
  'settings.data.nothingToUndo': 'Nothing to undo.',
  'settings.data.last': 'Last: {event} · {relativeTime}',
  'settings.data.resetData': 'Reset data',
  'settings.data.resetWarning': 'This deletes everything stored on this device.',

  // Settings — About card
  'settings.about.title': 'About',
  'settings.about.appVersion': 'App version',
  'settings.about.schemaVersion': 'Schema version',
  'settings.about.cacheName': 'Cache name',
  'settings.about.serviceWorker': 'Service worker',

  // Settings — Mastery card
  'settings.mastery.title': 'Mastery',
  'settings.mastery.threshold': 'Completion threshold',
  'settings.mastery.thresholdAria': 'Mastery completion threshold %',
  'settings.mastery.pct': '%',
  'settings.mastery.window': 'Rolling window',
  'settings.mastery.windowAria': 'Mastery rolling window days',
  'settings.mastery.days': 'days',

  // Settings — Scoring Model card
  'settings.scoring.title': 'Scoring Model',
  'settings.scoring.legend': 'Scoring model',
  'settings.scoring.s1': 'S1 — Rolling Threshold',
  'settings.scoring.s2': 'S2 — Day-Weighted',
  'settings.scoring.s3': 'S3 — Load-Adjusted',

  // Desktop — Analytics
  'desktop.analytics.scoringModel': 'Scoring Model: ',
  'desktop.analytics.habit': 'Habit',
  'desktop.analytics.mastered': 'Mastered',
  'desktop.analytics.stage': 'Stage {n}',

  // Desktop — Planning
  'desktop.planning.waveHabit': 'Wave / Habit',
  'desktop.planning.noUpcoming': 'No upcoming habit starts',
  'desktop.planning.scheduleHint': 'Habits you plan to start in the future will appear here. Schedule them in the ',
  'desktop.planning.catalogView': 'Catalog view',
  'desktop.planning.scheduleHintEnd': '.',

  // Desktop — Waveboard
  'desktop.waveboard.habit': 'Habit',

  // Desktop — WavePlanning
  'desktop.wavePlanning.upcoming': 'Upcoming',
  'desktop.wavePlanning.noData': 'No data',
  'desktop.wavePlanning.promoteToActive': 'Promote to active',
  'desktop.wavePlanning.scheduled': 'Scheduled',
  'desktop.wavePlanning.noHabitsInWave': 'No habits in this wave.',
};
