import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStatusIndicatorPlacement,
} from '../../app/utils/statusBadgeLayout.js';

describe('resolveStatusIndicatorPlacement (non-overlapping centered calendar badges)', () => {
  test('returns none when neither edited nor drift indicators are active', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: false,
        hasDrift: false,
        hasBadge: true,
        badgeWidth: 24,
        availWidth: 60,
        availHeight: 80,
        usedHeight: 40,
      }),
      'none'
    );
  });

  test('places indicator in right grid track (header-side) when symmetric side room fits without shifting badge', () => {
    // Desktop wide column with "Magistral" (46px in 180px -> 67px per side)
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 46,
        availWidth: 180,
        availHeight: 90,
        usedHeight: 60,
      }),
      'header-side'
    );

    // Mobile 5-day column (~58px) with short "GA" badge (~20px -> 19px per side >= 15px)
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 20,
        availWidth: 58,
        availHeight: 76,
        usedHeight: 50,
      }),
      'header-side'
    );

    // Mobile 5-day column (~58px) with "GL1" badge (~24px -> 17px per side >= 15px)
    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 24,
        availWidth: 58,
        availHeight: 76,
        usedHeight: 50,
      }),
      'header-side'
    );
  });

  test('drops indicator to centered mini-row below badge (header-below) when side room is tight but vertical room exists', () => {
    // Mobile 5-day column (~58px) with wide "Magistral" (~44px -> 7px per side < 15px) and 2h block height
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 44,
        availWidth: 58,
        availHeight: 110,
        usedHeight: 70,
      }),
      'header-below'
    );

    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 44,
        availWidth: 58,
        availHeight: 110,
        usedHeight: 95, // 15px spare >= 14px
      }),
      'header-below'
    );
  });

  test('falls back to border/corner accent when neither symmetric side space nor vertical spare room fits', () => {
    // Short mobile block with wide "Magistral" badge and tight vertical space
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: true,
        badgeWidth: 44,
        availWidth: 58,
        availHeight: 52,
        usedHeight: 44, // only 8px spare < 14px
      }),
      'border'
    );

    // Parallel 2-column narrow mobile block (~28px) with "GL1" (~22px) and tight height
    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: true,
        badgeWidth: 22,
        availWidth: 28,
        availHeight: 40,
        usedHeight: 34,
      }),
      'border'
    );
  });

  test('handles badge-less blocks cleanly with header-only when spare height permits and border when compact', () => {
    assert.equal(
      resolveStatusIndicatorPlacement({
        showEditedIcon: true,
        hasBadge: false,
        availWidth: 58,
        availHeight: 70,
        usedHeight: 40,
      }),
      'header-only'
    );

    assert.equal(
      resolveStatusIndicatorPlacement({
        hasDrift: true,
        hasBadge: false,
        availWidth: 58,
        availHeight: 28,
        usedHeight: 24,
      }),
      'border'
    );
  });
});
