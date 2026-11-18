import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStatusIndicatorPlacement,
  getMaxCenteredBadgeWidthForCorner,
} from '../../app/utils/statusBadgeLayout.js';

describe('resolveStatusIndicatorPlacement (always top-right corner tab, progressive sizing)', () => {
  test('returns none when neither edited nor drift indicators are active', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: false,
        hasDrift: false,
        hasBadge: true,
        badgeWidth: 24,
        blockWidth: 62,
      }),
      'none'
    );
  });

  test('picks corner-lg (13px) on wide desktop columns and mobile blocks with short badges like GA/GL1', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 46,
        blockWidth: 185,
      }),
      'corner-lg'
    );

    // Mobile 5-day column (62px) with GA (~20px -> 21px per side >= 15px) -> corner-lg
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 20,
        blockWidth: 62,
      }),
      'corner-lg'
    );
  });

  test('scales down smoothly to corner-md (11px), corner-sm (9px) and corner-xs (8px) while staying in top-right corner', () => {
    // 62px block, 36px badge -> 13px per side (>= 12px, < 15px) -> corner-md
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 36,
        blockWidth: 62,
      }),
      'corner-md'
    );

    // 62px block, 42px badge -> 10px per side (>= 9.5px, < 12px) -> corner-sm
    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 42,
        blockWidth: 62,
      }),
      'corner-sm'
    );

    // Narrow parallel column (30px) with 22px badge -> corner-xs (never moves below badge)
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 22,
        blockWidth: 30,
      }),
      'corner-xs'
    );
  });

  test('getMaxCenteredBadgeWidthForCorner leaves symmetric room for at least corner-xs without shifting badge', () => {
    assert.equal(
      getMaxCenteredBadgeWidthForCorner({ showEditedIcon: false, hasDrift: false, blockWidth: 60 }),
      60
    );
    // 60px block - (8 + 1) * 2 = 42px max badge width to leave 9px cleanly on each side
    assert.equal(
      getMaxCenteredBadgeWidthForCorner({ showEditedIcon: true, blockWidth: 60 }),
      42
    );
  });

  test('keeps badge-less blocks consistently in top-right corner scaled by block width', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({ showEditedIcon: true, hasBadge: false, blockWidth: 160 }),
      'corner-lg'
    );
    assert.equal(
      resolveStatusIndicatorPlacement({ showEditedIcon: true, hasBadge: false, blockWidth: 58 }),
      'corner-md'
    );
    assert.equal(
      resolveStatusIndicatorPlacement({ showEditedIcon: true, hasBadge: false, blockWidth: 15 }),
      'corner-sm'
    );
  });
});
