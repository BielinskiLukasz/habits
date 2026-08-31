/**
 * @file English locale dictionary for the Nawyki i18n module. All user-visible
 * strings for every view builder and the Settings language card. Keys use
 * dot-notation namespaced by view (nav, today, catalog, history, settings,
 * desktop). Values are plain strings; {placeholder} syntax marks interpolation
 * points substituted by t() at call time. Namespaces: catalog (UI + error
 * strings), history (error + nav), settings (error strings), toast (dismiss +
 * undo error), today (error + undo toast strings).
 */

/** @type {Record<string, string>} */
export const EN = {
  // Navigation
  'nav.today': 'today',
  'nav.history': 'history',
  'nav.catalog': 'catalog',
  'nav.settings': 'settings',
  'nav.analytics': 'analytics',

  // Today view
  'today.title': 'Habits',
  'today.empty': 'No habits scheduled today.',
  'today.allDone': 'All done today — see you tomorrow.',
  'today.count': '{done} of {total}',
  'today.showPolish': 'Show original Polish name',
  'today.phaseTooltip': 'Coming in Phase 4',
  'today.skip': 'Skip',
  'today.fail': 'Fail',
  'today.skipped': 'Skipped',
  'today.failed': 'Failed',

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
  'settings.language.label': 'Display language: ',
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
  'settings.data.exportGroup': 'Export data',
  'settings.data.exportJson': 'Export JSON',
  'settings.data.exportCsv': 'Export CSV',
  'settings.data.importGroup': 'Import data',
  'settings.data.recomputeGroup': 'Data recalculation',
  'settings.data.recomputing': 'Recomputing…',
  'settings.data.recomputeScores': 'Recompute Scores',
  'settings.data.lastActionGroup': 'Last action',
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

  // Util — relative time
  'util.justNow': 'just now',
  'util.minutesAgo': '{n} minutes ago',
  'util.hoursAgo': '{n} hours ago',
  'util.daysAgo': '{n} days ago',

  // History — extra
  'history.noHabits': 'No applicable habits for this day.',
  'history.slots': 'slots',

  // History — new keys (I18N-02)
  'history.errorMark': "Couldn't mark — try again",
  'history.errorSkip': "Couldn't skip — try again",
  'history.nextDay': 'Next day',
  'history.prevDay': 'Previous day',

  // Today — extra
  'today.slots': 'slots',

  // Today — new keys (I18N-02)
  'today.errorMark': "Couldn't mark — try again",
  'today.errorSkip': "Couldn't skip — try again",
  'today.errorUpdateCount': "Couldn't update count — try again",
  'today.errorUpdateSlot': "Couldn't update slot — try again",
  'today.listAriaLabel': "Today's habits",
  'today.markedComplete': 'Marked {name} complete',
  'today.markedUncomplete': 'Marked {name} uncomplete',

  // Catalog — cadence type options
  'catalog.cadence.daily': 'Daily',
  'catalog.cadence.weekly': 'Weekly',
  'catalog.cadence.monthly': 'Monthly',
  'catalog.cadence.everyNDays': 'Every N days',
  'catalog.cadence.specificDays': 'Specific days',

  // Catalog — target type options
  'catalog.targetType.binary': 'Binary (done/not done)',
  'catalog.targetType.numeric': 'Numeric (count)',
  'catalog.targetType.slotChecklist': 'Slot checklist',

  // Catalog — panel actions
  'catalog.save': 'Save',
  'catalog.cancel': 'Cancel',
  'catalog.stagePlaceholder': 'Stage label',

  // Catalog — new keys (I18N-02)
  'catalog.empty': 'No habits yet. Tap "New habit" to create one.',
  'catalog.errorAdvanceStage': "Couldn't advance stage — try again",
  'catalog.errorArchive': "Couldn't archive habit — try again",
  'catalog.errorCreate': "Couldn't create habit — try again",
  'catalog.errorPromote': "Couldn't promote habit — try again",
  'catalog.errorRestore': "Couldn't restore habit — try again",
  'catalog.errorSave': "Couldn't save habit — try again",
  'catalog.listAriaLabel': 'Habit catalog',
  'catalog.stageTargetPlaceholder': 'Target (optional)',
  'catalog.upcomingAriaLabel': 'Upcoming habits',
  'catalog.upcomingHeading': 'Upcoming',

  // Settings — Data card extra strings
  'settings.data.never': 'Never',
  'settings.data.backupDaysAgo': '{n} days ago',
  'settings.data.nagNoBackup': 'No backup found. Export your data now.',
  'settings.data.nagDaysAgo': 'Last backup: {n} days ago. Export your data now.',

  // Page headings (static HTML)
  'page.settings': 'Settings',
  'page.history': 'History',

  // Desktop shell
  'desktop.title': 'Habit Analytics',
  'desktop.nav.analytics': 'Analytics',
  'desktop.nav.waveboard': 'Wave Board',
  'desktop.nav.planning': 'Planning',
  'desktop.nav.settings': 'Settings',
  'desktop.wavePlanning.title': 'Wave Planning',

  // Settings — Data card
  'settings.data.openDesktop': 'Open desktop analytics →',

  // Settings — Storage card (dynamic text)
  'settings.storage.unknown': 'unknown',

  // Settings — About card (dynamic text)
  'settings.about.na': 'n/a',
  'settings.about.none': 'none',
  'settings.about.unsupported': 'unsupported',
  'settings.about.swControlled': 'controlled',
  'settings.about.swRegistered': 'registered',

  // Util — singular relative time
  'util.minuteAgo': '1 minute ago',
  'util.hourAgo': '1 hour ago',
  'util.dayAgo': '1 day ago',

  // Analytics table column headers
  'desktop.analytics.stageCol': 'Stage',
  'desktop.analytics.rollingPctCol': 'Rolling %',
  'desktop.analytics.masteryCol': 'Mastery',
  'desktop.analytics.modelScore': '{model} Score',

  // Shared desktop S1 status badge names
  'desktop.status.healthy': 'Healthy',
  'desktop.status.watch': 'Watch',
  'desktop.status.atRisk': 'At Risk',
  'desktop.status.failing': 'Failing',

  // Show archived toggle (analytics + waveboard)
  'desktop.showArchived': 'Show archived',

  // Waveboard
  'desktop.waveboard.scoreMatrix': 'Score Matrix',
  'desktop.waveboard.notApplicable': 'Not applicable',
  'desktop.waveboard.cellTitle': '{status} ({completed}/{applicable} days)',
  'desktop.waveboard.gracePeriod': 'Grace period',

  // Wave Planning
  'desktop.wavePlanning.countsText': '{active} active · {scheduled} scheduled',
  'desktop.wavePlanning.promoteFailed': 'Failed — try again',

  // Cadence summary with actual count
  'catalog.cadence.everyNDaysCount': 'Every {n} days',

  // Analytics — avg abbreviation
  'desktop.analytics.avg': 'avg',

  // Settings — last event descriptions
  'settings.data.markedComplete': 'marked {name} complete',
  'settings.data.markedUncomplete': 'marked {name} uncomplete',
  'settings.data.changedSetting': 'changed {key} to {value}',
  'settings.data.unknownHabit': '(habit)',

  // Settings — custom file import button
  'settings.data.chooseFile': 'Choose file to import',
  'settings.data.noFileChosen': 'No file chosen',

  // Settings — new error keys (I18N-02)
  'settings.errorDismissNag': "Couldn't dismiss reminder: {msg}",
  'settings.errorExportCsv': 'CSV export failed: {msg}',
  'settings.errorExportJson': 'JSON export failed: {msg}',
  'settings.errorImport': 'Import failed: {msg}',
  'settings.errorMasteryThreshold': "Couldn't change mastery threshold — try again",
  'settings.errorMasteryWindow': "Couldn't change mastery window — try again",
  'settings.errorPersistenceRequest': "Couldn't request persistence",
  'settings.errorPersistenceUnsupported': 'Storage persistence not supported in this browser',
  'settings.errorRecompute': 'Recompute failed: {msg}',
  'settings.errorScoringModel': "Couldn't change scoring model — try again",
  'settings.errorUndo': "Couldn't undo — try again",
  'settings.errorWeekStart': "Couldn't change week start — try again",

  // Toast — new keys (I18N-02)
  'toast.dismiss': 'Dismiss',
  'toast.errorUndo': "Couldn't undo — try again",
};
