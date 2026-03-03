import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { BadRequestError, ForbiddenError } from '../exceptions.js';
import * as repo from '../infrastructure/projectRepository.js';

function projectRoot(projectId) {
  return path.join(config.projectsDir, projectId);
}

async function getRole(projectId, userId) {
  const p = await repo.get(projectId);
  if (p.owner_id === userId) return 'owner';
  const collab = (await repo.getCollaborators(projectId)).find((c) => c.user_id === userId);
  return collab ? collab.role : null;
}

export async function hasProjectAccess(projectId, userId, requiredRole = 'read') {
  const role = await getRole(projectId, userId);
  if (!role) return false;
  if (role === 'owner') return true;
  if (requiredRole === 'read') return true;
  return role === 'write';
}

async function requireAccess(projectId, userId, requiredRole = 'read') {
  const p = await repo.get(projectId);
  if (!(await hasProjectAccess(projectId, userId, requiredRole))) throw new ForbiddenError('Access denied');
  return p;
}

async function requireOwner(projectId, userId) {
  const p = await repo.get(projectId);
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

export async function listByOwner(ownerId) {
  const ids = await repo.listIdsByOwner(ownerId);
  return Promise.all(ids.map((id) => repo.get(id)));
}

export async function listAccessible(userId) {
  const owned = new Set(await repo.listIdsByOwner(userId));
  const shared = await repo.listIdsWhereCollaborator(userId);
  shared.forEach((id) => owned.add(id));
  return Promise.all([...owned].map((id) => repo.get(id)));
}

export async function get(projectId, userId) {
  await requireAccess(projectId, userId, 'read');
  return repo.get(projectId);
}

export async function requireWriteAccess(projectId, userId) {
  await requireAccess(projectId, userId, 'write');
}

export async function create(ownerId, body, templateId = null) {
  if ((await repo.countByOwner(ownerId)) >= config.maxProjectsPerUser) {
    throw new BadRequestError(`Maximum projects per user (${config.maxProjectsPerUser}) exceeded`);
  }
  const projectId = randomUUID().slice(0, 8);
  const name = (body.name && body.name.trim()) || 'Untitled';
  const mainFile = 'main.tex';
  const tid = body.template_id || templateId;
  if (tid) {
    return createFromTemplate(projectId, name, ownerId, tid);
  }
  await repo.create(projectId, name, ownerId, mainFile);
  if (!config.useMongo) {
    const root = projectRoot(projectId);
    fs.writeFileSync(path.join(root, 'main.tex'), defaultTex, 'utf8');
  } else {
    const { connectMongo } = await import('../infrastructure/mongoClient.js');
    const db = await connectMongo();
    await db.collection('project_files').insertOne({
      project_id: projectId,
      path: 'main.tex',
      content: defaultTex,
      updated_at: new Date().toISOString(),
    });
  }
  return repo.get(projectId);
}

async function createFromTemplate(projectId, name, ownerId, templateId) {
  const templatesDir = config.templatesDir;
  const templatePath = path.join(templatesDir, templateId);
  if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isDirectory()) {
    throw new BadRequestError('Template not found');
  }
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
  await repo.create(projectId, name, ownerId, mainFile);
  if (config.useMongo) {
    const { connectMongo } = await import('../infrastructure/mongoClient.js');
    const db = await connectMongo();
    const filesColl = db.collection('project_files');
    function copyRecursive(src, basePath = '') {
      const entries = [];
      for (const name of fs.readdirSync(src)) {
        if (name.startsWith('.') || name === 'manifest.json') continue;
        const full = path.join(src, name);
        const rel = basePath ? `${basePath}/${name}` : name;
        if (fs.statSync(full).isDirectory()) {
          entries.push(...copyRecursive(full, rel));
        } else {
          entries.push({ path: rel, content: fs.readFileSync(full, 'utf8') });
        }
      }
      return entries;
    }
    const entries = copyRecursive(templatePath);
    if (entries.length) {
      await filesColl.insertMany(
        entries.map((e) => ({
          project_id: projectId,
          path: e.path,
          content: e.content,
          updated_at: new Date().toISOString(),
        })),
      );
    }
  } else {
    const root = projectRoot(projectId);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'meta.txt'), name, 'utf8');
    fs.writeFileSync(path.join(root, 'owner.txt'), ownerId, 'utf8');
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
  }
  return repo.get(projectId);
}

export async function update(projectId, userId, body) {
  await requireAccess(projectId, userId, 'write');
  if (body.name != null) {
    await repo.updateName(projectId, (body.name && body.name.trim()) || 'Untitled');
  }
  if (body.main_file != null) {
    await repo.updateMainFile(projectId, body.main_file);
  }
  if (body.compiler != null) {
    await repo.updateCompiler(projectId, body.compiler);
  }
  return repo.get(projectId);
}

export async function remove(projectId, userId) {
  await requireOwner(projectId, userId);
  await repo.remove(projectId);
}

export async function clone(projectId, userId) {
  const orig = await get(projectId, userId);
  if ((await repo.countByOwner(userId)) >= config.maxProjectsPerUser) {
    throw new BadRequestError(`Maximum projects per user (${config.maxProjectsPerUser}) exceeded`);
  }
  const newId = randomUUID().slice(0, 8);
  if (config.useMongo) {
    await repo.create(newId, `${orig.name} (копия)`, userId, orig.main_file);
    const { connectMongo } = await import('../infrastructure/mongoClient.js');
    const db = await connectMongo();
    const files = await db.collection('project_files').find({ project_id: projectId }).toArray();
    if (files.length) {
      await db.collection('project_files').insertMany(
        files.map((f) => ({
          project_id: newId,
          path: f.path,
          content: f.content,
          updated_at: new Date().toISOString(),
        })),
      );
    }
  } else {
    const origRoot = projectRoot(projectId);
    const newRoot = projectRoot(newId);
    fs.cpSync(origRoot, newRoot, { recursive: true });
    fs.writeFileSync(path.join(newRoot, 'meta.txt'), `${orig.name} (копия)`, 'utf8');
    fs.writeFileSync(path.join(newRoot, 'owner.txt'), userId, 'utf8');
    const collabPath = path.join(newRoot, 'collaborators.json');
    if (fs.existsSync(collabPath)) fs.unlinkSync(collabPath);
  }
  return repo.get(newId);
}

export async function listCollaborators(projectId, userId) {
  await requireAccess(projectId, userId, 'read');
  return repo.getCollaborators(projectId);
}

export async function addCollaborator(projectId, ownerId, body) {
  await requireOwner(projectId, ownerId);
  const targetUserId = (body?.user_id || body?.username || '').toString().trim();
  if (!targetUserId) throw new BadRequestError('user_id or username is required');
  const role = (body?.role === 'write' ? 'write' : 'read') || 'read';
  await repo.addCollaborator(projectId, targetUserId, role);
  return repo.getCollaborators(projectId);
}

export async function removeCollaborator(projectId, ownerId, targetUserId) {
  await requireOwner(projectId, ownerId);
  await repo.removeCollaborator(projectId, targetUserId);
  return repo.getCollaborators(projectId);
}
