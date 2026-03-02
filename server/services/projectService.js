import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { BadRequestError, ForbiddenError } from '../exceptions.js';
import * as repo from '../infrastructure/projectRepository.js';

function projectRoot(projectId) {
  return path.join(config.projectsDir, projectId);
}

function getRole(projectId, userId) {
  const p = repo.get(projectId);
  if (p.owner_id === userId) return 'owner';
  const collab = repo.getCollaborators(projectId).find((c) => c.user_id === userId);
  return collab ? collab.role : null;
}

export function hasProjectAccess(projectId, userId, requiredRole = 'read') {
  const role = getRole(projectId, userId);
  if (!role) return false;
  if (role === 'owner') return true;
  if (requiredRole === 'read') return true;
  return role === 'write';
}

function requireAccess(projectId, userId, requiredRole = 'read') {
  const p = repo.get(projectId);
  if (!hasProjectAccess(projectId, userId, requiredRole)) throw new ForbiddenError('Access denied');
  return p;
}

function requireOwner(projectId, userId) {
  const p = repo.get(projectId);
  if (p.owner_id !== userId) throw new ForbiddenError('Only the project owner can perform this action');
  return p;
}

const defaultTex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[russian]{babel}
\\begin{document}
Hello, world!
\\end{document}
`;

export function listByOwner(ownerId) {
  const ids = repo.listIdsByOwner(ownerId);
  return ids.map((id) => repo.get(id));
}

export function listAccessible(userId) {
  const owned = new Set(repo.listIdsByOwner(userId));
  const shared = repo.listIdsWhereCollaborator(userId);
  shared.forEach((id) => owned.add(id));
  return [...owned].map((id) => repo.get(id));
}

export function get(projectId, userId) {
  requireAccess(projectId, userId, 'read');
  return repo.get(projectId);
}

export function requireWriteAccess(projectId, userId) {
  requireAccess(projectId, userId, 'write');
}

export function create(ownerId, body, templateId = null) {
  if (repo.countByOwner(ownerId) >= config.maxProjectsPerUser) {
    throw new BadRequestError(`Maximum projects per user (${config.maxProjectsPerUser}) exceeded`);
  }
  const projectId = randomUUID().slice(0, 8);
  const name = (body.name && body.name.trim()) || 'Untitled';
  const mainFile = 'main.tex';
  const tid = body.template_id || templateId;
  if (tid) {
    return createFromTemplate(projectId, name, ownerId, tid);
  }
  repo.create(projectId, name, ownerId, mainFile);
  const root = projectRoot(projectId);
  fs.writeFileSync(path.join(root, 'main.tex'), defaultTex, 'utf8');
  return repo.get(projectId);
}

function createFromTemplate(projectId, name, ownerId, templateId) {
  const templatesDir = config.templatesDir;
  const templatePath = path.join(templatesDir, templateId);
  if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isDirectory()) {
    throw new BadRequestError('Template not found');
  }
  const root = projectRoot(projectId);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'meta.txt'), name, 'utf8');
  fs.writeFileSync(path.join(root, 'owner.txt'), ownerId, 'utf8');
  let mainFile = 'main.tex';
  const manifestPath = path.join(templatePath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      mainFile = data.main_file || 'main.tex';
    } catch {
      /* manifest may be missing */
    }
  }
  fs.writeFileSync(path.join(root, 'main_file.txt'), mainFile, 'utf8');
  function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(src)) {
        if (name.startsWith('.') || name === 'manifest.json') continue;
        copyRecursive(path.join(src, name), path.join(dest, name));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  for (const name of fs.readdirSync(templatePath)) {
    if (name.startsWith('.') || name === 'manifest.json') continue;
    copyRecursive(path.join(templatePath, name), path.join(root, name));
  }
  return { id: projectId, name, owner_id: ownerId, main_file: mainFile };
}

export function update(projectId, userId, body) {
  requireAccess(projectId, userId, 'write');
  if (body.name != null) {
    repo.updateName(projectId, (body.name && body.name.trim()) || 'Untitled');
  }
  if (body.main_file != null) {
    repo.updateMainFile(projectId, body.main_file);
  }
  if (body.compiler != null) {
    repo.updateCompiler(projectId, body.compiler);
  }
  return repo.get(projectId);
}

export function remove(projectId, userId) {
  requireOwner(projectId, userId);
  repo.remove(projectId);
}

export function clone(projectId, userId) {
  const orig = get(projectId, userId);
  if (repo.countByOwner(userId) >= config.maxProjectsPerUser) {
    throw new BadRequestError(`Maximum projects per user (${config.maxProjectsPerUser}) exceeded`);
  }
  const newId = randomUUID().slice(0, 8);
  const origRoot = projectRoot(projectId);
  const newRoot = projectRoot(newId);
  fs.cpSync(origRoot, newRoot, { recursive: true });
  fs.writeFileSync(path.join(newRoot, 'meta.txt'), `${orig.name} (копия)`, 'utf8');
  fs.writeFileSync(path.join(newRoot, 'owner.txt'), userId, 'utf8');
  const collabPath = path.join(newRoot, 'collaborators.json');
  if (fs.existsSync(collabPath)) fs.unlinkSync(collabPath);
  return repo.get(newId);
}

export function listCollaborators(projectId, userId) {
  requireAccess(projectId, userId, 'read');
  return repo.getCollaborators(projectId);
}

export function addCollaborator(projectId, ownerId, body) {
  requireOwner(projectId, ownerId);
  const userId = (body?.user_id || body?.username || '').toString().trim();
  if (!userId) throw new BadRequestError('user_id or username is required');
  const role = (body?.role === 'write' ? 'write' : 'read') || 'read';
  repo.addCollaborator(projectId, userId, role);
  return repo.getCollaborators(projectId);
}

export function removeCollaborator(projectId, ownerId, targetUserId) {
  requireOwner(projectId, ownerId);
  repo.removeCollaborator(projectId, targetUserId);
  return repo.getCollaborators(projectId);
}
