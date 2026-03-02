import path from 'path';
import { config } from '../config.js';
import { ConflictError } from '../exceptions.js';
import { run as runCompile } from '../infrastructure/compileRunner.js';
import * as projectService from './projectService.js';

const compileLocks = new Map();

function getLock(projectId) {
  if (!compileLocks.has(projectId)) {
    compileLocks.set(projectId, { locked: false, queue: [] });
  }
  return compileLocks.get(projectId);
}

export async function compile(projectId, userId) {
  projectService.requireWriteAccess(projectId, userId);
  const proj = projectService.get(projectId, userId);
  const root = path.join(config.projectsDir, projectId);
  const lock = getLock(projectId);
  if (lock.locked) {
    throw new ConflictError('Compilation already in progress for this project');
  }
  lock.locked = true;
  try {
    return await runCompile(root, proj.main_file, proj.compiler || 'pdflatex');
  } finally {
    lock.locked = false;
  }
}
