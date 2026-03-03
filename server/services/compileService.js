import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config.js';
import { ConflictError } from '../exceptions.js';
import { run as runCompile } from '../infrastructure/compileRunner.js';
import { materializeProjectToDir } from '../infrastructure/fileStoreMongo.js';
import * as projectService from './projectService.js';

const compileLocks = new Map();

function getLock(projectId) {
  if (!compileLocks.has(projectId)) {
    compileLocks.set(projectId, { locked: false, queue: [] });
  }
  return compileLocks.get(projectId);
}

export async function compile(projectId, userId) {
  await projectService.requireWriteAccess(projectId, userId);
  if (config.clsiUrl) {
    const headers = { 'Content-Type': 'application/json' };
    if (config.clsiApiKey) headers['X-CLSI-Key'] = config.clsiApiKey;
    const res = await fetch(`${config.clsiUrl}/compile`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `CLSI returned ${res.status}`);
    }
    return { success: data.success, log: data.log, errors: data.errors || [], hasWarnings: data.hasWarnings };
  }
  const proj = await projectService.get(projectId, userId);
  const lock = getLock(projectId);
  if (lock.locked) {
    throw new ConflictError('Compilation already in progress for this project');
  }
  lock.locked = true;
  let root = path.join(config.projectsDir, projectId);
  let tempDir = null;
  if (config.useMongo) {
    if (config.documentUpdaterUrl && config.redisUri) {
      try {
        await fetch(`${config.documentUpdaterUrl}/doc/flush`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
      } catch {
        /* ignore flush failure */
      }
    }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `letutex-${projectId}-`));
    root = tempDir;
    await materializeProjectToDir(projectId, root);
  }
  try {
    const result = await runCompile(root, proj.main_file, proj.compiler || 'pdflatex');
    if (tempDir && result.success) {
      const pdfName = path.basename(proj.main_file, path.extname(proj.main_file)) + '.pdf';
      const base = path.basename(proj.main_file, path.extname(proj.main_file));
      const outDir = path.join(config.outputsDir, projectId);
      fs.mkdirSync(outDir, { recursive: true });
      const srcPdf = path.join(root, pdfName);
      const outPdf = path.join(outDir, pdfName);
      if (fs.existsSync(srcPdf)) fs.copyFileSync(srcPdf, outPdf);
      const srcSynctex = path.join(root, base + '.synctex.gz');
      const outSynctex = path.join(outDir, base + '.synctex.gz');
      if (fs.existsSync(srcSynctex)) fs.copyFileSync(srcSynctex, outSynctex);
    }
    return result;
  } finally {
    lock.locked = false;
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  }
}
