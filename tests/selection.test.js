import { describe, expect, test } from 'bun:test';
import { captureSelectionSnapshot, restoreSelectionSnapshot } from '../src/ui/selection.ts';

describe('selection snapshot helpers', () => {
  test('captures text and restores the cloned range', () => {
    const clonedRange = { id: 'cloned-range' };
    const originalRange = {
      cloneRange: () => clonedRange,
    };
    const selection = {
      rangeCount: 1,
      toString: () => 'selected text',
      getRangeAt: () => originalRange,
    };

    const snapshot = captureSelectionSnapshot(selection);

    expect(snapshot?.text).toBe('selected text');
    expect(snapshot?.range).toBe(clonedRange);

    const restoredSelection = {
      removed: 0,
      added: [],
      removeAllRanges() {
        this.removed += 1;
      },
      addRange(range) {
        this.added.push(range);
      },
    };

    restoreSelectionSnapshot(snapshot, restoredSelection);

    expect(restoredSelection.removed).toBe(1);
    expect(restoredSelection.added).toEqual([clonedRange]);
  });
});
