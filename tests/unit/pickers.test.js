import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseValueToCalendarDate,
  parseValueToTime,
  calculateMonthGridPadding,
  formatMonthYearHeading,
  formatTime,
  SPANISH_MONTHS,
  SPANISH_MONTHS_SHORT,
  getDaysInMonth,
  clampDayToMonth,
  buildValidCalendarDate,
} from '../../app/utils/dateTimeUtils.js';

describe('Pickers unit suite (DatePicker & TimePicker)', () => {
  describe('DatePicker parseValueToCalendarDate', () => {
    test('parses integer YYYYMMDD date format', () => {
      const parsed = parseValueToCalendarDate(20261225);
      assert.ok(parsed);
      assert.equal(parsed.year, 2026);
      assert.equal(parsed.month, 12);
      assert.equal(parsed.day, 25);
    });

    test('parses hyphenated YYYY-MM-DD string format', () => {
      const parsed = parseValueToCalendarDate('2026-05-18');
      assert.ok(parsed);
      assert.equal(parsed.year, 2026);
      assert.equal(parsed.month, 5);
      assert.equal(parsed.day, 18);
    });

    test('parses JS Date object', () => {
      const jsDate = new Date(2026, 10, 17); // Nov 17 2026
      const parsed = parseValueToCalendarDate(jsDate);
      assert.ok(parsed);
      assert.equal(parsed.year, 2026);
      assert.equal(parsed.month, 11);
      assert.equal(parsed.day, 17);
    });

    test('returns null for null, empty, or invalid input', () => {
      assert.equal(parseValueToCalendarDate(null), null);
      assert.equal(parseValueToCalendarDate(''), null);
      assert.equal(parseValueToCalendarDate(undefined), null);
      assert.equal(parseValueToCalendarDate('invalid-date'), null);
    });
  });

  describe('Calendar grid 6-row stability across months', () => {
    test('ensures every month across multiple academic years resolves to exactly 6 total rows with padding', () => {
      // Test 36 consecutive months from 2025 to 2027
      for (let y = 2025; y <= 2027; y++) {
        for (let m = 1; m <= 12; m++) {
          const { weeksCount, paddingWeeks, totalRows } = calculateMonthGridPadding(y, m);

          assert.equal(totalRows, 6, `Mes ${y}-${m} debe sumar exactamente 6 filas constantes`);
          assert.ok(weeksCount >= 4 && weeksCount <= 6, `Semanas naturales deben estar entre 4 y 6 (obtenido ${weeksCount})`);
          assert.ok(paddingWeeks >= 0 && paddingWeeks <= 2, `Padding de semanas debe estar entre 0 y 2 (obtenido ${paddingWeeks})`);
        }
      }
    });

    test('month heading format has no "De" and capitalizes only month name', () => {
      for (let m = 1; m <= 12; m++) {
        const heading = formatMonthYearHeading(2026, m);
        assert.ok(!heading.includes(' De '), `La cabecera no debe contener "De": ${heading}`);
        assert.ok(!heading.includes(' de '), `La cabecera no debe contener "de": ${heading}`);
        assert.match(heading, /^[A-Z][a-z]+ 2026$/);
      }
      assert.equal(SPANISH_MONTHS.length, 12);
      assert.equal(SPANISH_MONTHS_SHORT.length, 12);
    });

    test('buildValidCalendarDate validates real calendar dates including leap years', () => {
      const valid = buildValidCalendarDate('18', '11', '2026');
      assert.ok(valid);
      assert.equal(valid.year, 2026);
      assert.equal(valid.month, 11);
      assert.equal(valid.day, 18);

      const leapValid = buildValidCalendarDate(29, 2, 2028);
      assert.ok(leapValid);
      assert.equal(leapValid.day, 29);

      assert.equal(buildValidCalendarDate(29, 2, 2026), null);
      assert.equal(buildValidCalendarDate(31, 4, 2026), null);
      assert.equal(buildValidCalendarDate(0, 5, 2026), null);
      assert.equal(buildValidCalendarDate(15, 13, 2026), null);
      assert.equal(buildValidCalendarDate(15, 5, 1899), null);
      assert.equal(buildValidCalendarDate('', '11', '2026'), null);
    });

    test('getDaysInMonth and clampDayToMonth clamp month transitions safely', () => {
      assert.equal(getDaysInMonth(2026, 2), 28);
      assert.equal(getDaysInMonth(2028, 2), 29);
      assert.equal(getDaysInMonth(2026, 4), 30);
      assert.equal(getDaysInMonth(2026, 13), 0);

      assert.equal(clampDayToMonth(31, 2, 2026), 28);
      assert.equal(clampDayToMonth(31, 2, 2028), 29);
      assert.equal(clampDayToMonth(31, 4, 2026), 30);
      assert.equal(clampDayToMonth(0, 6, 2026), 1);
    });
  });

  describe('Time conversion and parsing', () => {
    test('converts HH:MM string and integer numbers consistently', () => {
      assert.deepEqual(parseValueToTime('08:30'), { hour: 8, minute: 30 });
      assert.deepEqual(parseValueToTime(830), { hour: 8, minute: 30 });
      assert.deepEqual(parseValueToTime('14:45'), { hour: 14, minute: 45 });
      assert.deepEqual(parseValueToTime(1445), { hour: 14, minute: 45 });
      assert.deepEqual(parseValueToTime('00:00'), { hour: 0, minute: 0 });
      assert.deepEqual(parseValueToTime(0), { hour: 0, minute: 0 });
      assert.deepEqual(parseValueToTime('23:59'), { hour: 23, minute: 59 });
      assert.deepEqual(parseValueToTime(2359), { hour: 23, minute: 59 });
      assert.equal(parseValueToTime(null), null);
      assert.equal(parseValueToTime(''), null);
    });

    test('preserves irregular minutes in options list', () => {
      const baseMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
      const irregularMinute = 12;
      const merged = !baseMinutes.includes(irregularMinute)
        ? [...baseMinutes, irregularMinute].sort((a, b) => a - b).map((m) => String(m).padStart(2, '0'))
        : baseMinutes.map((m) => String(m).padStart(2, '0'));

      assert.ok(merged.includes('12'));
      assert.equal(merged[3], '12', '12 debe colocarse entre 10 y 15');
    });

    test('formatTime always pads hours and minutes to 2 digits in 24h h23 cycle', () => {
      assert.equal(formatTime(900), '09:00');
      assert.equal(formatTime(805), '08:05');
      assert.equal(formatTime(0), '00:00');
      assert.equal(formatTime(2359), '23:59');
      assert.equal(formatTime('9:00'), '09:00');
      assert.equal(formatTime('09:30'), '09:30');
      assert.equal(formatTime(new Date(2026, 10, 17, 9, 5)), '09:05');
      assert.equal(formatTime(null), '');
      assert.equal(formatTime('invalid'), '');
    });
  });
});
