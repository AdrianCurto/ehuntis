const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  getAcademicYearBounds,
  toDateNumber,
  parseDateNumber,
  toMinutes,
  differenceInDays,
  getDayOfWeekName,
  formatDateShort,
  getLessonsForDate,
  getLastLessonEndMinutes,
  getDynamicWeekDates,
  getWeekMonday,
} = require('../../app/utils/dayLogic');

const {
  getSubjectColorStyle,
  PALETTE,
  PALETTE_DARK,
} = require('../../app/utils/colorLogic');

describe('dayLogic and colorLogic feature test suite', () => {
  describe('Date conversion and academic bounds', () => {
    test('toDateNumber and parseDateNumber are inverse operations', () => {
      const original = new Date(2026, 10, 9); // Nov 9, 2026
      const num = toDateNumber(original);
      assert.equal(num, 20261109);

      const parsed = parseDateNumber(num);
      assert.equal(parsed.getFullYear(), 2026);
      assert.equal(parsed.getMonth(), 10);
      assert.equal(parsed.getDate(), 9);
    });

    test('getAcademicYearBounds calculates correct boundaries', () => {
      const novDate = new Date(2026, 10, 15);
      const boundsNov = getAcademicYearBounds(novDate);
      assert.equal(boundsNov.start.getFullYear(), 2026);
      assert.equal(boundsNov.start.getMonth(), 8); // September
      assert.equal(boundsNov.end.getFullYear(), 2027);
      assert.equal(boundsNov.end.getMonth(), 5); // June

      const marDate = new Date(2027, 2, 10);
      const boundsMar = getAcademicYearBounds(marDate);
      assert.equal(boundsMar.start.getFullYear(), 2026);
      assert.equal(boundsMar.end.getFullYear(), 2027);
    });

    test('toMinutes parses numbers and strings accurately', () => {
      assert.equal(toMinutes(830), 510);
      assert.equal(toMinutes(1445), 885);
      assert.equal(toMinutes('08:30'), 510);
      assert.equal(toMinutes('14:45'), 885);
      assert.equal(toMinutes(null), 0);
    });

    test('differenceInDays computes exact day difference', () => {
      const d1 = new Date(2026, 10, 9);
      const d2 = new Date(2026, 10, 16);
      assert.equal(differenceInDays(d2, d1), 7);
    });
  });

  describe('Lesson filtering by date and cancellation status', () => {
    test('getLessonsForDate includes active classes and excludes cancelled or dimmed classes', () => {
      const list = [
        { id: 1, date: 20261109, code: null, isDimmed: false },
        { id: 2, date: 20261109, code: 'cancelled', isUserCancelled: true }, // user cancelled override
        { id: 3, date: 20261109, code: null, isDimmed: true },              // dimmed subgroup
        { id: 4, date: 20261110, code: null, isDimmed: false },             // different date
      ];

      const active = getLessonsForDate(list, 20261109);
      assert.equal(active.length, 1);
      assert.equal(active[0].id, 1);
    });

    test('getLastLessonEndMinutes finds latest end time in list', () => {
      const list = [
        { id: 1, endTime: 1100 }, // 660 min
        { id: 2, endTime: 1430 }, // 870 min (latest)
        { id: 3, endTime: 1300 }, // 780 min
      ];
      assert.equal(getLastLessonEndMinutes(list), 870);
      assert.equal(getLastLessonEndMinutes([]), null);
    });
  });

  describe('getDynamicWeekDates with custom events & weekend support', () => {
    test('returns standard Monday-Friday when no weekend events exist', () => {
      const monday = new Date(2026, 10, 9); // Nov 9
      const lessons = [
        { date: 20261109 },
        { date: 20261111 },
      ];
      const dates = getDynamicWeekDates(monday, lessons);
      assert.equal(dates.length, 5); // Mon-Fri
    });

    test('extends to Saturday when Saturday event exists', () => {
      const monday = new Date(2026, 10, 9);
      const lessons = [
        { date: 20261114, isCustomEvent: true }, // Saturday Nov 14
      ];
      const dates = getDynamicWeekDates(monday, lessons);
      assert.equal(dates.length, 6); // Mon-Sat
    });

    test('extends to Sunday when Sunday event exists', () => {
      const monday = new Date(2026, 10, 9);
      const lessons = [
        { date: 20261115, isCustomEvent: true }, // Sunday Nov 15
      ];
      const dates = getDynamicWeekDates(monday, lessons);
      assert.equal(dates.length, 7); // Mon-Sun
    });
  });

  describe('getSubjectColorStyle from colorLogic', () => {
    test('returns light and dark palette color styles with valid hex codes', () => {
      for (let i = 0; i < PALETTE.length; i++) {
        const light = getSubjectColorStyle(i, false);
        assert.equal(light.bg, PALETTE[i].bg);
        assert.equal(light.text, PALETTE[i].text);

        const dark = getSubjectColorStyle(i, true);
        assert.equal(dark.bg, PALETTE_DARK[i].bg);
        assert.equal(dark.text, PALETTE_DARK[i].text);
      }
    });

    test('safely wraps large indices using palette modulo', () => {
      const wrapped = getSubjectColorStyle(999, false);
      const expectedIdx = 999 % PALETTE.length;
      assert.equal(wrapped.bg, PALETTE[expectedIdx].bg);
    });
  });
});
