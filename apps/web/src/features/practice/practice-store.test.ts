import { describe, expect, it } from 'vitest';

import { usePracticeStore } from './practice-store';

describe('usePracticeStore', () => {
  it('conserva la semilla pedida aunque se cambie una opción mientras carga el texto', async () => {
    const store = usePracticeStore.getState();
    const loading = store.next(99);
    const configured = store.configure({ mode: 'words', wordCount: 10 });
    await Promise.all([loading, configured]);

    const reference = usePracticeStore.getState();
    expect(reference.seed).toBe(99);
    const text = reference.source?.text;

    await usePracticeStore.getState().next(1);
    await usePracticeStore.getState().next(99);
    expect(usePracticeStore.getState().source?.text).toBe(text);
  });
});
