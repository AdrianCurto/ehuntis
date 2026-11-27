import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSheetDismissThreshold,
  shouldDismissSheet,
  getSheetExitDurationMs,
  resolveSheetTouchStart,
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

describe('Sheet touchstart scroll vs drag resolution', () => {
  test('blocks drag inside [data-sheet-no-drag] even when sheet has no [data-sheet-scroll] (TimePicker)', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        isNoDrag: true,
        hasDedicatedScroll: false,
        isInsideDedicatedScroll: false,
        hasScrolledAncestor: false,
      }),
      { canDrag: false, isFixedDragZone: false }
    );
    assert.deepEqual(
      resolveSheetTouchStart({
        isNoDrag: true,
        hasDedicatedScroll: false,
        isInsideDedicatedScroll: false,
        hasScrolledAncestor: true,
      }),
      { canDrag: false, isFixedDragZone: false }
    );
  });

  test('blocks drag inside form controls unless explicitly opted in with allowDragOnFormControl', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        isFormControl: true,
        hasDedicatedScroll: true,
        isInsideDedicatedScroll: false,
      }),
      { canDrag: false, isFixedDragZone: false }
    );
    assert.deepEqual(
      resolveSheetTouchStart({
        isFormControl: true,
        allowDragOnFormControl: true,
        hasDedicatedScroll: false,
        hasScrolledAncestor: false,
      }),
      { canDrag: true, isFixedDragZone: false }
    );
  });

  test('blocks drag in sheets without [data-sheet-scroll] when contentEl or a child is scrolled', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        hasDedicatedScroll: false,
        isInsideDedicatedScroll: false,
        hasScrolledAncestor: true,
      }),
      { canDrag: false, isFixedDragZone: false }
    );
  });

  test('allows non-fixed drag at scrollTop === 0 in sheets without [data-sheet-scroll] so upward swipes still scroll', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        hasDedicatedScroll: false,
        isInsideDedicatedScroll: false,
        hasScrolledAncestor: false,
      }),
      { canDrag: true, isFixedDragZone: false }
    );
  });

  test('allows fixed-zone drag from header/footer outside [data-sheet-scroll] even if body is scrolled', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        hasDedicatedScroll: true,
        isInsideDedicatedScroll: false,
        hasScrolledAncestor: false,
      }),
      { canDrag: true, isFixedDragZone: true }
    );
  });

  test('blocks drag inside [data-sheet-scroll] when scrolled, allows non-fixed drag at top', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        hasDedicatedScroll: true,
        isInsideDedicatedScroll: true,
        hasScrolledAncestor: true,
      }),
      { canDrag: false, isFixedDragZone: false }
    );
    assert.deepEqual(
      resolveSheetTouchStart({
        hasDedicatedScroll: true,
        isInsideDedicatedScroll: true,
        hasScrolledAncestor: false,
      }),
      { canDrag: true, isFixedDragZone: false }
    );
  });

  test('always allows fixed-zone drag from handle even when content is scrolled', () => {
    assert.deepEqual(
      resolveSheetTouchStart({
        fromHandle: true,
        hasDedicatedScroll: false,
        hasScrolledAncestor: true,
      }),
      { canDrag: true, isFixedDragZone: true }
    );
  });
});
