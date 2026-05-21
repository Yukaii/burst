export type SelectionSnapshot = {
  text: string;
  range: Range | null;
};

type SelectionLike = Pick<Selection, 'rangeCount' | 'toString' | 'getRangeAt' | 'removeAllRanges' | 'addRange'>;

export function captureSelectionSnapshot(selection: SelectionLike | null | undefined): SelectionSnapshot {
  if (!selection || selection.rangeCount === 0) {
    return { text: '', range: null };
  }

  try {
    return {
      text: selection.toString(),
      range: selection.getRangeAt(0).cloneRange(),
    };
  } catch {
    return { text: selection.toString(), range: null };
  }
}

export function restoreSelectionSnapshot(
  snapshot: SelectionSnapshot | null | undefined,
  selection: SelectionLike | null | undefined = window.getSelection(),
): void {
  if (!snapshot?.range || !selection) return;

  try {
    selection.removeAllRanges();
    selection.addRange(snapshot.range);
  } catch {
    // If the page invalidated the DOM range, keep the captured text and continue.
  }
}
