import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStatusIndicatorPlacement,
  needsBelowStatusRow,
} from '../../app/utils/statusBadgeLayout.js';

describe('resolveStatusIndicatorPlacement (progressive top-right corner badge scaling)', () => {
  test('returns none when neither edited nor drift indicators are active', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: false,
        hasDrift: false,
        hasBadge: true,
        badgeWidth: 24,
        blockWidth: 62,
        availWidth: 57,
        availHeight: 80,
        usedHeight: 40,
      }),
      'none'
    );
  });

  test('places normal 13px icon in header-side when symmetric inner room fits without shifting badge', () => {
    // Desktop wide column with "Magistral"
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 46,
        blockWidth: 185,
        availWidth: 180,
        availHeight: 90,
        usedHeight: 60,
      }),
      'header-side'
    );

    // Mobile 5-day column with short "GA" badge (~20px -> 19px per side >= 15px)
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 20,
        blockWidth: 63,
        availWidth: 58,
        availHeight: 76,
        usedHeight: 50,
      }),
      'header-side'
    );
  });

  test('scales down progressively to top-right corner-md (11px) and corner-sm (9px) without touching centered badge', () => {
    // Mobile 5-day column (62px, availWidth 57px) with medium badge (36px):
    // inner space = (57 - 36) / 2 = 10.5px (< 15px), corner space = (62 - 36) / 2 = 13px (>= 12px) -> corner-md
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 36,
        blockWidth: 62,
        availWidth: 57,
        availHeight: 76,
        usedHeight: 68,
      }),
      'corner-md'
    );

    // Slightly wider badge (42px in 62px): corner space = 10px (>= 9.5px, < 12px) -> corner-sm
    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 42,
        blockWidth: 62,
        availWidth: 57,
        availHeight: 76,
        usedHeight: 68,
      }),
      'corner-sm'
    );
  });

  test('drops to header-below when badge reaches near the edge and spare height exists, or corner-xs when micro-compact', () => {
    // Wide "Magistral" (48px in 60px -> corner space 6px < 9.5px) with vertical spare room -> header-below
    assert.equal(
      needsBelowStatusRow({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 48,
        blockWidth: 60,
      }),
      true
    );

    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 48,
        blockWidth: 60,
        availWidth: 55,
        availHeight: 110,
        usedHeight: 80,
      }),
      'header-below'
    );

    // Extreme micro-block (28px wide, badge 24px, tight height) -> corner-xs real-icon tab
    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 24,
        blockWidth: 28,
        availWidth: 26,
        availHeight: 34,
        usedHeight: 30,
      }),
      'corner-xs'
    );
  });

  test('keeps badge-less blocks consistently in top-right corner with zero height loss', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: false,
        blockWidth: 58,
        availWidth: 53,
        availHeight: 40,
        usedHeight: 36,
      }),
      'corner-md'
    );

    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: false,
        blockWidth: 15,
        availWidth: 13,
        availHeight: 28,
        usedHeight: 26,
      }),
      'corner-sm'
    );
  });
});
