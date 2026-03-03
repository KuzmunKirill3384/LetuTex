import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import * as projectService from './projectService.js';

const BIB_ENTRY_RE = /@\s*\w+\s*\{\s*([^,\s}]+)/g;

function scanFile(filePath) {
  const keys = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let m;
    BIB_ENTRY_RE.lastIndex = 0;
    while ((m = BIB_ENTRY_RE.exec(content)) !== null) {
      keys.push(m[1].trim());
    }
  } catch {
    /* ignore unreadable bib */
  }
  return keys;
}

function scanDir(dir, basePath, keys) {
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && !name.startsWith('.')) {
      scanDir(full, basePath, keys);
      continue;
    }
    if (name.toLowerCase().endsWith('.bib')) {
      keys.push(...scanFile(full));
    }
  }
}

export async function getBibKeys(projectId, userId) {
  await projectService.get(projectId, userId);
  if (config.useMongo) {
    const { createFileStoreMongo } = await import('../infrastructure/fileStoreMongo.js');
    const store = createFileStoreMongo(projectId);
    const files = await store.listFiles();
    const keys = [];
    for (const f of files) {
      if (f.is_dir || !f.path.toLowerCase().endsWith('.bib')) continue;
      try {
        const content = await store.read(f.path);
        let m;
        BIB_ENTRY_RE.lastIndex = 0;
        while ((m = BIB_ENTRY_RE.exec(content)) !== null) keys.push(m[1].trim());
      } catch {
        /* ignore */
      }
    }
    return { keys: [...new Set(keys)] };
  }
  const rootDir = path.join(config.projectsDir, projectId);
  if (!fs.existsSync(rootDir)) return { keys: [] };
  const keys = [];
  scanDir(rootDir, rootDir, keys);
  const unique = [...new Set(keys)];
  return { keys: unique };
}
