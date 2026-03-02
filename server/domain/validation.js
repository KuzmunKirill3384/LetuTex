import path from 'path';
import { ForbiddenError, BadRequestError } from '../exceptions.js';

const SKIP_EXTENSIONS = new Set([
  '.aux',
  '.log',
  '.synctex.gz',
  '.synctex',
  '.out',
  '.toc',
  '.fls',
  '.fdb_latexmk',
  '.nav',
  '.snm',
  '.vrb',
  '.bbl',
  '.blg',
  '.idx',
  '.ind',
  '.ilg',
  '.lof',
  '.lot',
]);
const META_FILES = new Set(['meta.txt', 'main_file.txt', 'owner.txt', 'compiler.txt']);
const ALLOWED_EXTENSIONS = new Set([
  '.tex',
  '.bib',
  '.sty',
  '.cls',
  '.bst',
  '.cfg',
  '.def',
  '.fd',
  '.bbx',
  '.cbx',
  '.lbx',
  '.mp',
  '.dtx',
  '.ins',
  '.txt',
  '.md',
  '.csv',
]);
const UPLOAD_EXTENSIONS = new Set([
  ...ALLOWED_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.eps',
  '.pdf',
  '.tif',
  '.tiff',
  '.bmp',
]);

export function validatePathInsideProject(projectRoot, filePath) {
  const resolved = path.resolve(projectRoot, filePath);
  const rootResolved = path.resolve(projectRoot);
  if (!resolved.startsWith(rootResolved) || resolved === rootResolved) {
    throw new ForbiddenError('Invalid path');
  }
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new ForbiddenError('Invalid path');
  }
  return resolved;
}

export function validateFileExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestError(`Extension ${ext} not allowed`);
  }
  if (filePath.trim() !== filePath || filePath.includes('\0')) {
    throw new BadRequestError('Invalid path');
  }
}

export function validateUploadExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && !UPLOAD_EXTENSIONS.has(ext)) {
    throw new BadRequestError(`Extension ${ext} not allowed for upload`);
  }
  if (filePath.trim() !== filePath || filePath.includes('\0')) {
    throw new BadRequestError('Invalid path');
  }
}

export function isBinaryExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.eps', '.pdf', '.tif', '.tiff', '.bmp'].includes(ext);
}

export function validateContentSize(content, maxBytes) {
  const encoded = Buffer.byteLength(content, 'utf8');
  if (encoded > maxBytes) {
    throw new BadRequestError(`File size exceeds limit (${maxBytes} bytes)`);
  }
}

export function isProjectFile(name) {
  if (META_FILES.has(name)) return false;
  if (name.startsWith('.')) return false;
  const ext = path.extname(name).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return false;
  return true;
}

const LINE_RE = /^l\.(\d+)/;
const LINE_ALT_RE = /^Line\s+(\d+)\s/;
const TEX_FILE_EXT = /\.(?:tex|sty|cls|bib|dtx|ltx)$/i;

function normalizeTexPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^\.\//, '').replace(/\\/g, '/');
  return s || null;
}

function trackFiles(line, fileStack) {
  let pos = 0;
  while (pos < line.length) {
    if (line[pos] === '(') {
      const rest = line.slice(pos + 1);
      const fileMatch = rest.match(/^([^\s()]+)/);
      if (fileMatch && TEX_FILE_EXT.test(fileMatch[1])) {
        fileStack.push(normalizeTexPath(fileMatch[1]));
        pos += 1 + fileMatch[1].length;
        continue;
      }
      fileStack.push(null);
      pos++;
    } else if (line[pos] === ')') {
      if (fileStack.length > 0) fileStack.pop();
      pos++;
    } else {
      pos++;
    }
  }
}

function currentFileFromStack(fileStack) {
  for (let i = fileStack.length - 1; i >= 0; i--) {
    if (fileStack[i]) return fileStack[i];
  }
  return null;
}

export function parseLatexErrors(log) {
  const errors = [];
  const fileStack = [];
  const lines = log.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    trackFiles(line, fileStack);
    const currentFile = currentFileFromStack(fileStack);

    if (line.startsWith('!')) {
      let lineNum = null;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const m = lines[j].match(LINE_RE);
        if (m) {
          lineNum = parseInt(m[1], 10);
          break;
        }
      }
      errors.push({ file: currentFile, line: lineNum, message: line.trim() });
    }

    if (line.startsWith('l.')) {
      const m = line.match(LINE_RE);
      if (m && !errors.some((e) => e.line === parseInt(m[1], 10) && e.file === currentFile)) {
        errors.push({ file: currentFile, line: parseInt(m[1], 10), message: line.trim() });
      }
    }

    if (LINE_ALT_RE.test(line)) {
      const m = line.match(LINE_ALT_RE);
      errors.push({ file: currentFile, line: m ? parseInt(m[1], 10) : null, message: line.trim() });
    }

    const warnMatch = line.match(/^LaTeX Warning:.*on input line (\d+)/);
    if (warnMatch) {
      errors.push({
        file: currentFile,
        line: parseInt(warnMatch[1], 10),
        message: line.trim(),
        severity: 'warning',
      });
    }

    const overfull = line.match(/^(?:Over|Under)full .*at lines? (\d+)/);
    if (overfull) {
      errors.push({
        file: currentFile,
        line: parseInt(overfull[1], 10),
        message: line.trim(),
        severity: 'warning',
      });
    }
  }

  return errors;
}
