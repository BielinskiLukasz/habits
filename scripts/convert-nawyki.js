/**
 * @file Convert Nawyki.csv + Nawyki-fale.txt into a habits-app JSON import file.
 *
 * Usage:
 *   node scripts/convert-nawyki.js
 *
 * Outputs nawyki-import.json in the project root, ready for File → Import JSON
 * in the app. Reads Nawyki.csv with latin1 encoding (the file is CP1250 from
 * Excel/Windows) — completion cells are ASCII-safe; habit names are hardcoded
 * to avoid encoding artifacts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Wave assignment: CSV habit ID → wave number (derived from Nawyki-fale.txt)
// ---------------------------------------------------------------------------
const WAVE_MAP = {
  // Wave 0 — pre-start onboarding
  5: 0, 4: 0, 52: 0, 39: 0, 3: 0, 42: 0, 40: 0, 1: 0,
  56: 0, 57: 0, 61: 0, 62: 0, 63: 0, 65: 0,
  // Wave 1 — energy & regulation
  7: 1, 59: 1, 24: 1, 10: 1, 31: 1, 18: 1, 48: 1,
  // Wave 2 — daily rhythm & eating
  30: 2, 11: 2, 32: 2, 45: 2, 46: 2, 22: 2, 50: 2, 47: 2,
  // Wave 3 — movement & body
  26: 3, 29: 3, 54: 3, 15: 3, 20: 3,
  // Wave 4 — relationships & emotions
  49: 4, 60: 4, 58: 4, 53: 4, 35: 4, 25: 4, 27: 4, 36: 4, 37: 4,
  // Wave 5 — order & organisation
  6: 5, 55: 5, 21: 5, 34: 5, 16: 5, 51: 5,
  // Wave 6 — diet & restrictions
  13: 6, 17: 6, 14: 6, 19: 6, 28: 6,
  // Wave 7 — digital minimalism & hard behaviours
  2: 7, 41: 7, 33: 7, 38: 7,
  // Wave 8 — hygiene & health
  43: 8, 9: 8, 44: 8,
  // Wave 9 — development & competencies (66 added post-plan)
  12: 9, 23: 9, 8: 9, 64: 9, 66: 9,
};

// ---------------------------------------------------------------------------
// English names (primary) keyed by CSV habit ID
// ---------------------------------------------------------------------------
const NAME_EN = {
  1:  'Limit social media: 5 min',
  2:  'Limit screen gaming: 1 hour',
  3:  'Clean living room after son',
  4:  'Morning walk with son: 15 min',
  5:  'Morning without phone: 30 min',
  6:  'Weekly planning: 10 min [Sunday]',
  7:  'Glass of water on waking',
  8:  'Gaming with others: 1 hour',
  9:  'Floss teeth',
  10: 'Phone on desk before bed: 1 hour',
  11: 'Vegetables: 1 serving',
  12: 'Reading: 10 pages',
  13: 'Limit sweets: 1 serving',
  14: 'Drink 2 liters of water',
  15: 'Evening activity with son: 20 min',
  16: 'Tidy 1 spot: 5 min',
  17: 'Limit fast food: max 1 [Sunday]',
  18: 'Steps: 7k',
  19: 'Cook for family: 7 meals/week',
  20: 'Meatless meal: 7/week',
  21: 'Weekly priority: 3 tasks [Sunday]',
  22: 'Sleep before 11 PM',
  23: 'Skill learning: 20 min',
  24: 'Meditation / mindful breathing: 5 min',
  25: 'Family contact every 1-2 weeks [Sunday]',
  26: 'Home workout: 10 push-ups, 20 squats, 30s plank',
  27: 'Contact outside family: 1 [Sunday]',
  28: 'Creativity: 5 min',
  29: 'Intense exercise: 30 min',
  30: 'Lunch at 12-15',
  31: 'Stretching: 5 min',
  32: 'Fruit: 1 piece',
  33: 'No screens before bed: 30 min',
  34: 'Desk tidy: 2 min [weekdays]',
  35: 'Read to son: 1 story',
  36: 'Help wife: 1 task',
  37: 'Gratitude: 5 things',
  38: 'Stop biting nails',
  39: 'Morning warm-up: 5 min',
  40: 'Finances (weekly, monthly)',
  41: 'Limit TV: 45 min',
  42: 'Take out trash',
  43: 'Brush teeth',
  44: 'Shower every 2 days',
  45: 'Eat with family: 3 meals',
  46: 'No screens while eating',
  47: 'Sitting breaks: 1 min every hour',
  48: 'Priority list: 3 tasks',
  49: 'Talk with wife: 5 min',
  50: 'Personal break: 5 min',
  51: 'Home care: 10 min [Saturday]',
  52: 'Supplements',
  53: 'Closeness ritual with wife: 10 min',
  54: 'Family walk: 30 min + photo',
  55: 'Family weekly planning: 15 min [Sunday]',
  56: 'Bakery shopping',
  57: 'Wake up at 6:30',
  58: 'Morning son routine',
  59: 'Evening bottle sterilization',
  60: 'Morning tea & coffee',
  61: 'Evening tea',
  62: 'Morning weigh-in',
  63: 'Log sleep duration',
  64: 'Gaming with wife: 1 hour',
  65: "Son's evening bath",
  66: 'Total phone screen time: 2 hours',
};

// ---------------------------------------------------------------------------
// Polish names (name_pl) keyed by CSV habit ID — correctly spelled
// ---------------------------------------------------------------------------
const NAME_PL = {
  1:  'Ograniczenie mediów społ.: 5 min',
  2:  'Ograniczenie grania na ekranie: 1 godzina',
  3:  'Sprzątanie salonu po synu',
  4:  'Spacer z synem (poranny): 15 min',
  5:  'Poranek bez telefonu: 30 min',
  6:  'Planowanie tygodnia w todo liście: 10 min [nd]',
  7:  '1 szklanka wody po przebudzeniu',
  8:  'Godzina gry z innymi',
  9:  'Nitkowanie zębów',
  10: 'Telefon na biurko przed snem: 1 h',
  11: 'Warzywa: 1 porcja',
  12: 'Czytanie: 10 stron',
  13: 'Ograniczenie słodyczy: 1 porcja',
  14: 'Woda: wypicie 2 litrów',
  15: 'Wieczorna aktywność z synem: 20 min',
  16: 'Sprzątanie 1 miejsca: 5 min',
  17: 'Ograniczenie fast foodów: max 1 [nd]',
  18: 'Kroki: 7k kroków',
  19: 'Posiłek dla rodziny: 7 posiłków',
  20: 'Posiłek bez mięsa: 7 posiłków',
  21: 'Tygodniowy priorytet: 3 zadania [nd]',
  22: 'Sen przed 23',
  23: 'Nauka kompetencji: 20 min',
  24: 'Medytacja / świadomy oddech: 5 min',
  25: 'Kontakt z rodziną co 1-2 tygodnie [nd]',
  26: 'Ćwiczenia: 10 pompek, 20 przysiadów, 30s deska',
  27: 'Kontakt z osobą spoza rodziny: 1 kontakt [nd]',
  28: 'Kreatywność: 5 min',
  29: 'Intensywne ćwiczenia: 30 min',
  30: 'Obiad 12-15',
  31: 'Rozciąganie: 5 min',
  32: 'Owoce: 1 owoc',
  33: 'Brak ekranów przed snem: 30 min',
  34: 'Sprzątanie biurka: 2 min [pn-pt]',
  35: 'Czytanie synowi: 1 opowiadanie',
  36: 'Pomoc żonie: 1 rzecz',
  37: 'Wdzięczność: 5 rzeczy',
  38: 'Eliminacja drapania paznokci',
  39: 'Poranna rozgrzewka: 5 min',
  40: 'Finanse (tygodniowe, miesięczne)',
  41: 'Ograniczenie telewizji: 45 min',
  42: 'Wyrzucenie śmieci',
  43: 'Mycie zębów',
  44: 'Prysznic co 2 dni',
  45: 'Jedzenie z rodziną: 3 posiłki',
  46: 'Brak ekranów przy jedzeniu',
  47: 'Przerwy od siedzenia: 1 min co 1 h',
  48: 'Lista priorytetów: 3 zadania',
  49: 'Rozmowa z żoną: 5 min',
  50: 'Przerwa dla siebie: 5 min',
  51: 'Dbanie o dom: 10 min [sb]',
  52: 'Suplementacja',
  53: 'Rytuał bliskości z żoną: 10 min',
  54: 'Rodzinny spacer: 30 min + zdjęcie',
  55: 'Wspólne planowanie tygodnia rodzinnego: 15 min [nd]',
  56: 'Zakupy w piekarni',
  57: 'Wstawanie o 6:30',
  58: 'Poranne ogarnianie syna',
  59: 'Wieczorne wyparzanie butelki',
  60: 'Poranne parzenie herbaty + kawy',
  61: 'Wieczorne parzenie herbaty',
  62: 'Poranne ważenie',
  63: 'Zapis długości snu w aplikacji',
  64: 'Godzina gry z żoną',
  65: 'Wieczorna kąpiel syna',
  66: 'Całkowity czas przed ekranem telefonu: 2 godz',
};

// ---------------------------------------------------------------------------
// CSV parser — handles RFC 4180 quoting with comma delimiter
// ---------------------------------------------------------------------------
function parseCSVRow(line) {
  const fields = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // trailing empty field after last comma handled by loop exit
      break;
    }
    if (line[i] === '"') {
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const csvPath = path.join(ROOT, 'Nawyki.csv');
  // Read as latin1 — the file is CP1250 from Windows Excel; latin1 is byte-safe
  // so commas, digits, and date strings are preserved correctly. Polish characters
  // in Nazwa/Nazwa etapu are not used (name_pl is hardcoded above).
  const raw = fs.readFileSync(csvPath, 'latin1');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Row 0 = header; parse date column names
  const header = parseCSVRow(lines[0]);
  const DATE_COL_OFFSET = 8; // first date column index
  // Collect only valid YYYY-MM-DD date headers
  const dateCols = header.slice(DATE_COL_OFFSET).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

  const habits = [];
  const logs = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r].trimEnd();
    if (!line) continue;

    const fields = parseCSVRow(line);
    if (fields.length < DATE_COL_OFFSET) continue;

    const csvId = parseInt(fields[0], 10);
    if (isNaN(csvId)) continue;

    const startDate = fields[5].trim() || null;   // YYYY-MM-DD or empty
    const isWeekly  = fields[6].trim() === '1';

    const habitId = crypto.randomUUID();
    const wave    = WAVE_MAP[csvId] ?? 0;

    // Cadence: weekly habits → type:'weekly', others → type:'daily'
    const cadence = isWeekly
      ? { cadence_v: 1, type: 'weekly' }
      : { cadence_v: 1, type: 'daily' };

    habits.push({
      id:   habitId,
      name: NAME_EN[csvId] ?? `Habit ${csvId}`,
      name_pl: NAME_PL[csvId] ?? null,
      wave,
      status: startDate > TODAY ? 'scheduled' : 'active',
      cadence,
      targetType: 'binary',
      stages: [],
      currentStageIndex: 0,
      stageStartedAt: null,
      masteryThresholdOverride: null,
      masteryWindowOverride: null,
      startDate,
    });

    // Parse completion columns — only record 0/1 rows; skip 'x' (not applicable)
    const completionCols = fields.slice(DATE_COL_OFFSET);
    for (let c = 0; c < dateCols.length; c++) {
      const val = (completionCols[c] ?? '').trim();
      if (val === '1' || val === '0') {
        logs.push({
          habitId,
          date: dateCols[c],
          completed: val === '1',
          definitionVersion: null,
        });
      }
    }
  }

  const output = {
    schemaVersion: 1,
    habits,
    habit_versions: [],
    logs,
    events: [],
    settings: [],
    meta: [],
    score_snapshots: [],
  };

  const outPath = path.join(ROOT, 'nawyki-import.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Done.`);
  console.log(`  Habits : ${habits.length}`);
  console.log(`  Logs   : ${logs.length}`);
  console.log(`  Output : ${outPath}`);
}

main();
