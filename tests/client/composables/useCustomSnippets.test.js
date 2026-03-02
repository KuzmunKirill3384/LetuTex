import { describe, it, expect, beforeEach } from 'vitest';

const STORAGE_KEY = 'leti-custom-snippets';

beforeEach(() => {
  localStorage.clear();
});

async function freshImport() {
  const mod = await import('../../../src/composables/useCustomSnippets.js');
  return mod.useCustomSnippets();
}

describe('useCustomSnippets', () => {
  it('starts with empty array if no localStorage data', async () => {
    const { customSnippets } = await freshImport();
    expect(customSnippets.value).toEqual([]);
  });

  it('addSnippet appends to the list', async () => {
    const { customSnippets, addSnippet } = await freshImport();
    addSnippet({ label: 'eq', title: 'Equation', snippet: '\\begin{equation}\\end{equation}' });
    expect(customSnippets.value.length).toBe(1);
    expect(customSnippets.value[0].label).toBe('eq');
  });

  it('removeSnippet removes by index', async () => {
    const { customSnippets, addSnippet, removeSnippet } = await freshImport();
    addSnippet({ label: 'a', snippet: 'aaa' });
    addSnippet({ label: 'b', snippet: 'bbb' });
    expect(customSnippets.value.length).toBe(2);
    removeSnippet(0);
    expect(customSnippets.value.length).toBe(1);
    expect(customSnippets.value[0].label).toBe('b');
  });

  it('loads from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ label: 'x', title: 'X', snippet: 'xxx' }]));
    const { customSnippets } = await freshImport();
    expect(customSnippets.value.length).toBe(1);
    expect(customSnippets.value[0].label).toBe('x');
  });
});
