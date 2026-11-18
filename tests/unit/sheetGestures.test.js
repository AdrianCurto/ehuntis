import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSheetDismissThreshold,
  shouldDismissSheet,
  getSheetExitDurationMs,
} from '../../app/utils/sheetGestures.js';

describe('Sheet swipe-to-dismiss gesture physics', () => {
  test('scales dismiss threshold smoothly with sheet height and respects min/max bounds', () => {
    assert.equal(getSheetDismissThreshold(300), 120);
    assert.equal(getSheetDismissThreshold(500), 150);
    assert.equal(getSheetDismissThreshold(800), 200);
  });

  test('does not dismiss on tiny drags or quick micro-swipes', () => {
    assert.equal(shouldDismissSheet(0, 450, 0), false);
    assert.equal(shouldDismissSheet(40, 450, 0.2), false);
    assert.equal(shouldDismissSheet(68, 450, 0.3), false);
    // Even a very fast micro-swipe under 72px should not dismiss accidentally
    assert.equal(shouldDismissSheet(50, 450, 1.5), false);
  });

  test('dismisses on intentional drag past threshold or deliberate flick', () => {
    assert.equal(shouldDismissSheet(140, 450, 0.1), true);
    assert.equal(shouldDismissSheet(200, 750, 0.05), true);
    assert.equal(shouldDismissSheet(85, 500, 0.8), true);
  });

  test('computes smooth bounded exit animation duration', () => {
    const slowDuration = getSheetExitDurationMs(150, 500, 0.1);
    const fastDuration = getSheetExitDurationMs(150, 500, 2.5);
    assert.ok(slowDuration >= 140 && slowDuration <= 230);
    assert.ok(fastDuration >= 110 && fastDuration <= 230);
    assert.ok(fastDuration <= slowDuration);
  });
});
