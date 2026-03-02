import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  validatePathInsideProject,
  validateFileExtension,
  validateUploadExtension,
  validateContentSize,
  isBinaryExtension,
  isProjectFile,
  parseLatexErrors,
} from '../../../server/domain/validation.js';

describe('validatePathInsideProject', () => {
  const root = '/tmp/project';

  it('accepts a valid relative path', () => {
    const resolved = validatePathInsideProject(root, 'main.tex');
    expect(resolved).toBe(path.resolve(root, 'main.tex'));
  });

  it('accepts a nested path', () => {
    const resolved = validatePathInsideProject(root, 'sections/intro.tex');
    expect(resolved).toBe(path.resolve(root, 'sections/intro.tex'));
  });

  it('rejects path traversal with ..', () => {
    expect(() => validatePathInsideProject(root, '../etc/passwd')).toThrow('Invalid path');
  });

  it('rejects absolute paths', () => {
    expect(() => validatePathInsideProject(root, '/etc/passwd')).toThrow('Invalid path');
  });

  it('rejects empty-ish path that resolves to root', () => {
    expect(() => validatePathInsideProject(root, '')).toThrow('Invalid path');
  });
});

describe('validateFileExtension', () => {
  it('allows .tex files', () => {
    expect(() => validateFileExtension('main.tex')).not.toThrow();
  });

  it('allows .bib files', () => {
    expect(() => validateFileExtension('refs.bib')).not.toThrow();
  });

  it('rejects .exe files', () => {
    expect(() => validateFileExtension('virus.exe')).toThrow('not allowed');
  });

  it('rejects files with null bytes', () => {
    expect(() => validateFileExtension('file\0.tex')).toThrow('Invalid path');
  });

  it('rejects files with leading/trailing spaces', () => {
    expect(() => validateFileExtension(' main.tex')).toThrow('Invalid path');
  });
});

describe('validateUploadExtension', () => {
  it('allows image uploads', () => {
    expect(() => validateUploadExtension('photo.png')).not.toThrow();
    expect(() => validateUploadExtension('diagram.pdf')).not.toThrow();
  });

  it('allows tex uploads', () => {
    expect(() => validateUploadExtension('chapter.tex')).not.toThrow();
  });

  it('rejects disallowed uploads', () => {
    expect(() => validateUploadExtension('script.sh')).toThrow('not allowed');
  });
});

describe('validateContentSize', () => {
  it('accepts content within limit', () => {
    expect(() => validateContentSize('hello', 100)).not.toThrow();
  });

  it('rejects content exceeding limit', () => {
    expect(() => validateContentSize('a'.repeat(200), 100)).toThrow('exceeds limit');
  });
});

describe('isBinaryExtension', () => {
  it('returns true for images', () => {
    expect(isBinaryExtension('photo.png')).toBe(true);
    expect(isBinaryExtension('file.jpg')).toBe(true);
  });

  it('returns false for text files', () => {
    expect(isBinaryExtension('main.tex')).toBe(false);
    expect(isBinaryExtension('refs.bib')).toBe(false);
  });
});

describe('isProjectFile', () => {
  it('returns true for .tex files', () => {
    expect(isProjectFile('main.tex')).toBe(true);
  });

  it('returns false for meta files', () => {
    expect(isProjectFile('meta.txt')).toBe(false);
    expect(isProjectFile('owner.txt')).toBe(false);
  });

  it('returns false for hidden files', () => {
    expect(isProjectFile('.gitignore')).toBe(false);
  });

  it('returns false for build artifacts', () => {
    expect(isProjectFile('main.aux')).toBe(false);
    expect(isProjectFile('main.log')).toBe(false);
  });
});

describe('parseLatexErrors', () => {
  it('extracts errors starting with !', () => {
    const log = '! Undefined control sequence.\nl.5 \\badcommand\n';
    const errors = parseLatexErrors(log);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.startsWith('!'))).toBe(true);
  });

  it('extracts line numbers from l.N format', () => {
    const log = 'l.42 some error text\n';
    const errors = parseLatexErrors(log);
    expect(errors.some((e) => e.line === 42)).toBe(true);
  });

  it('tracks current file from ( markers', () => {
    const log = '(./chapters/intro.tex\n! Missing $ inserted.\nl.10 some text\n';
    const errors = parseLatexErrors(log);
    const fileError = errors.find((e) => e.file);
    expect(fileError?.file).toBe('chapters/intro.tex');
  });

  it('returns empty array for clean log', () => {
    const log = 'This is pdfTeX, Version 3.14\nOutput written on main.pdf\n';
    const errors = parseLatexErrors(log);
    expect(errors).toEqual([]);
  });

  it('handles Line N format', () => {
    const log = 'Line 15 some error message\n';
    const errors = parseLatexErrors(log);
    expect(errors.some((e) => e.line === 15)).toBe(true);
  });
});
