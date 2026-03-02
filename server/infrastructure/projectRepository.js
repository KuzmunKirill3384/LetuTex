import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { NotFoundError } from '../exceptions.js';

const root = config.projectsDir;

function projectPath(projectId) {
  const p = path.resolve(root, projectId);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new NotFoundError('Project not found');
  }
  return p;
}

function getModifiedTime(dir) {
  try {
    let latest = fs.statSync(dir).mtimeMs;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.mtimeMs > latest) latest = st.mtimeMs;
      if (st.isDirectory()) {
        const sub = getModifiedTime(full);
        if (sub > latest) latest = sub;
      }
    }
    return latest;
  } catch {
    return Date.now();
  }
}

export function listIdsByOwner(ownerId) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const ownerFile = path.join(dir, 'owner.txt');
    if (fs.existsSync(ownerFile)) {
      if (fs.readFileSync(ownerFile, 'utf8').trim() === ownerId) result.push(name);
    } else if (ownerId === 'demo') {
      result.push(name);
    }
  }
  return result;
}

const COLLABORATORS_FILE = 'collaborators.json';

function readCollaborators(p) {
  const f = path.join(p, COLLABORATORS_FILE);
  if (!fs.existsSync(f)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function getCollaborators(projectId) {
  const p = projectPath(projectId);
  return readCollaborators(p);
}

export function addCollaborator(projectId, userId, role) {
  const p = projectPath(projectId);
  const list = readCollaborators(p).filter((c) => c.user_id !== userId);
  if (!['read', 'write'].includes(role)) role = 'read';
  list.push({ user_id: userId, role });
  fs.writeFileSync(path.join(p, COLLABORATORS_FILE), JSON.stringify(list, null, 2), 'utf8');
}

export function removeCollaborator(projectId, userId) {
  const p = projectPath(projectId);
  const list = readCollaborators(p).filter((c) => c.user_id !== userId);
  fs.writeFileSync(path.join(p, COLLABORATORS_FILE), JSON.stringify(list, null, 2), 'utf8');
}

export function listIdsWhereCollaborator(userId) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const list = readCollaborators(dir);
    if (list.some((c) => c.user_id === userId)) result.push(name);
  }
  return result;
}

export function get(projectId) {
  const p = projectPath(projectId);
  const metaPath = path.join(p, 'meta.txt');
  let name = path.basename(p);
  if (fs.existsSync(metaPath)) name = fs.readFileSync(metaPath, 'utf8').trim() || name;
  const ownerPath = path.join(p, 'owner.txt');
  let ownerId = 'demo';
  if (fs.existsSync(ownerPath)) ownerId = fs.readFileSync(ownerPath, 'utf8').trim();
  let mainFile = 'main.tex';
  const mainFilePath = path.join(p, 'main_file.txt');
  if (fs.existsSync(mainFilePath)) mainFile = fs.readFileSync(mainFilePath, 'utf8').trim() || 'main.tex';
  let compiler = 'pdflatex';
  const compilerPath = path.join(p, 'compiler.txt');
  if (fs.existsSync(compilerPath)) compiler = fs.readFileSync(compilerPath, 'utf8').trim() || 'pdflatex';
  const updated_at = new Date(getModifiedTime(p)).toISOString();
  return { id: projectId, name, owner_id: ownerId, main_file: mainFile, compiler, updated_at };
}

export function create(projectId, name, ownerId, mainFile = 'main.tex') {
  const dir = path.join(root, projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.txt'), (name || 'Untitled').trim(), 'utf8');
  fs.writeFileSync(path.join(dir, 'owner.txt'), ownerId, 'utf8');
  fs.writeFileSync(path.join(dir, 'main_file.txt'), mainFile, 'utf8');
  return {
    id: projectId,
    name: (name || 'Untitled').trim(),
    owner_id: ownerId,
    main_file: mainFile,
    updated_at: new Date().toISOString(),
  };
}

export function updateMainFile(projectId, mainFile) {
  const p = projectPath(projectId);
  fs.writeFileSync(path.join(p, 'main_file.txt'), mainFile, 'utf8');
}

export function updateCompiler(projectId, compiler) {
  const VALID = new Set(['pdflatex', 'xelatex', 'lualatex']);
  const p = projectPath(projectId);
  fs.writeFileSync(path.join(p, 'compiler.txt'), VALID.has(compiler) ? compiler : 'pdflatex', 'utf8');
}

export function updateName(projectId, name) {
  const p = projectPath(projectId);
  fs.writeFileSync(path.join(p, 'meta.txt'), (name || 'Untitled').trim(), 'utf8');
}

export function remove(projectId) {
  const p = projectPath(projectId);
  fs.rmSync(p, { recursive: true });
}

export function exists(projectId) {
  const dir = path.join(root, projectId);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

export function countByOwner(ownerId) {
  return listIdsByOwner(ownerId).length;
}
