import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import * as projectService from './projectService.js';

const NEWCOMMAND_RE = /\\(?:newcommand|renewcommand)\*?\s*\{([^}]+)\}/g;
const DEF_RE = /\\(?:def|gdef|edef|xdef)\s*\\([a-zA-Z@]+)/g;

function scanFileContent(content, filePath) {
  const defs = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    NEWCOMMAND_RE.lastIndex = 0;
    while ((m = NEWCOMMAND_RE.exec(line)) !== null) {
      defs.push({ name: m[1].trim(), file: filePath, line: i + 1 });
    }
    DEF_RE.lastIndex = 0;
    while ((m = DEF_RE.exec(line)) !== null) {
      defs.push({ name: '\\' + m[1], file: filePath, line: i + 1 });
    }
  }
  return defs;
}

function scanDir(dir, basePath, extensions) {
  const results = [];
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && !name.startsWith('.')) {
      results.push(...scanDir(full, basePath, extensions));
      continue;
    }
    const ext = path.extname(name).toLowerCase();
    if (!extensions.has(ext)) continue;
    const rel = path.relative(basePath, full).replace(/\\/g, '/');
    try {
      const content = fs.readFileSync(full, 'utf8');
      results.push(...scanFileContent(content, rel));
    } catch {
      /* ignore unreadable file */
    }
  }
  return results;
}

export function getDefinitions(projectId, userId) {
  projectService.get(projectId, userId);
  const rootDir = path.join(config.projectsDir, projectId);
  if (!fs.existsSync(rootDir)) return { definitions: {} };
  const exts = new Set(['.tex', '.sty', '.cls']);
  const list = scanDir(rootDir, rootDir, exts);
  const definitions = {};
  for (const d of list) {
    const key = d.name.startsWith('\\') ? d.name : '\\' + d.name;
    if (!definitions[key]) definitions[key] = [];
    definitions[key].push({ file: d.file, line: d.line });
  }
  return { definitions };
}
