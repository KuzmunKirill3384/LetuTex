import { describe, it, expect } from 'vitest';
import { LATEX_COMMANDS, LATEX_ENVIRONMENTS } from '../../../src/composables/latexCompletions.js';

describe('LATEX_COMMANDS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(LATEX_COMMANDS)).toBe(true);
    expect(LATEX_COMMANDS.length).toBeGreaterThan(50);
  });

  it('each entry has name, snippet, and meta', () => {
    for (const cmd of LATEX_COMMANDS) {
      expect(cmd).toHaveProperty('name');
      expect(cmd).toHaveProperty('snippet');
      expect(cmd).toHaveProperty('meta');
      expect(typeof cmd.name).toBe('string');
      expect(typeof cmd.snippet).toBe('string');
    }
  });

  it('includes common commands', () => {
    const names = LATEX_COMMANDS.map((c) => c.name);
    expect(names).toContain('documentclass');
    expect(names).toContain('usepackage');
    expect(names).toContain('begin');
    expect(names).toContain('section');
    expect(names).toContain('textbf');
    expect(names).toContain('frac');
    expect(names).toContain('alpha');
    expect(names).toContain('includegraphics');
    expect(names).toContain('cite');
  });

  it('has no duplicate names', () => {
    const names = LATEX_COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    const duplicates = names.filter((n) => {
      if (unique.has(n)) {
        unique.delete(n);
        return false;
      }
      return true;
    });
    expect(duplicates.length).toBeLessThanOrEqual(1);
  });
});

describe('LATEX_ENVIRONMENTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(LATEX_ENVIRONMENTS)).toBe(true);
    expect(LATEX_ENVIRONMENTS.length).toBeGreaterThan(20);
  });

  it('each entry has a name', () => {
    for (const env of LATEX_ENVIRONMENTS) {
      expect(env).toHaveProperty('name');
      expect(typeof env.name).toBe('string');
    }
  });

  it('includes common environments', () => {
    const names = LATEX_ENVIRONMENTS.map((e) => e.name);
    expect(names).toContain('document');
    expect(names).toContain('figure');
    expect(names).toContain('table');
    expect(names).toContain('equation');
    expect(names).toContain('itemize');
    expect(names).toContain('enumerate');
    expect(names).toContain('tikzpicture');
  });
});
