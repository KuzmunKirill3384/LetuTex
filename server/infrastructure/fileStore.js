import fs from 'fs';
import path from 'path';
import { NotFoundError } from '../exceptions.js';
import { isProjectFile } from '../domain/validation.js';

export function createFileStore(projectRoot) {
  const root = path.resolve(projectRoot);
  const historyDir = path.join(root, '.history');

  function resolve(filePath) {
    const full = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(root, filePath);
    const rel = path.relative(root, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new NotFoundError('Invalid path');
    }
    return full;
  }

  function saveHistory(filePath, content) {
    const key = filePath.replace(/\//g, '_').replace(/\\/g, '_');
    const dir = path.join(historyDir, key);
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 15);
    const versionId = ts;
    fs.writeFileSync(path.join(dir, `${versionId}.txt`), content, 'utf8');
  }

  function getStats() {
    let fileCount = 0;
    let totalSize = 0;
    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          if (name === '.history') continue;
          walk(full);
        } else if (isProjectFile(name)) {
          fileCount += 1;
          try {
            totalSize += fs.statSync(full).size;
          } catch {
            /* ignore */
          }
        }
      }
    }
    walk(root);
    return { fileCount, totalSize };
  }

  return {
    getStats,

    listFiles() {
      const result = [];
      function walk(dir, base = '') {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const rel = base ? `${base}/${name}` : name;
          if (fs.statSync(full).isDirectory()) {
            if (name === '.history') continue;
            walk(full, rel);
          } else if (isProjectFile(name)) {
            result.push({ path: rel.replace(/\\/g, '/'), name, is_dir: false });
          }
        }
      }
      walk(root);
      return result;
    },

    read(filePath) {
      const full = resolve(filePath);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        throw new NotFoundError('File not found');
      }
      return fs.readFileSync(full, 'utf8');
    },

    write(filePath, content, saveHistoryFlag = true) {
      const full = resolve(filePath);
      if (saveHistoryFlag && fs.existsSync(full)) {
        saveHistory(filePath, fs.readFileSync(full, 'utf8'));
      }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    },

    delete(filePath) {
      const full = resolve(filePath);
      if (!fs.existsSync(full)) throw new NotFoundError('File not found');
      if (fs.statSync(full).isFile()) {
        fs.unlinkSync(full);
      } else {
        fs.rmSync(full, { recursive: true });
      }
    },

    rename(oldPath, newPath) {
      const oldFull = resolve(oldPath);
      const newFull = resolve(newPath);
      if (!fs.existsSync(oldFull)) throw new NotFoundError('File not found');
      fs.mkdirSync(path.dirname(newFull), { recursive: true });
      fs.renameSync(oldFull, newFull);
    },

    exists(filePath) {
      try {
        return fs.existsSync(resolve(filePath));
      } catch {
        return false;
      }
    },

    listHistory(filePath) {
      const key = filePath.replace(/\//g, '_').replace(/\\/g, '_');
      const dir = path.join(historyDir, key);
      if (!fs.existsSync(dir)) return [];
      const result = [];
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .reverse()
        .slice(0, 50);
      for (const f of files) {
        const vid = path.basename(f, '.txt');
        let preview = '';
        try {
          const content = fs.readFileSync(path.join(dir, f), 'utf8');
          preview = content.slice(0, 80).replace(/\n/g, ' ');
        } catch {
          /* ignore unreadable version */
        }
        result.push({ id: vid, timestamp: vid, preview });
      }
      return result;
    },

    getHistoryContent(filePath, versionId) {
      const key = filePath.replace(/\//g, '_').replace(/\\/g, '_');
      const f = path.join(historyDir, key, `${versionId}.txt`);
      if (!fs.existsSync(f)) throw new NotFoundError('Version not found');
      return fs.readFileSync(f, 'utf8');
    },
  };
}
