import { Router } from 'express';
import * as projectService from '../services/projectService.js';
import * as fileService from '../services/fileService.js';
import * as bibKeysService from '../services/bibKeysService.js';
import { getById } from '../infrastructure/userStore.js';
import { config } from '../config.js';

const router = Router({ mergeParams: true });

async function enrichCollaborators(list) {
  const out = [];
  for (const c of list) {
    const u = await getById(c.user_id);
    out.push({ user_id: c.user_id, role: c.role, display_name: u?.display_name || u?.username || c.user_id });
  }
  return out;
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await projectService.listAccessible(req.user.id);
    const result = await Promise.all(
      projects.map(async (p) => {
        let file_count = 0;
        try {
          file_count = (await fileService.listFiles(p.id, req.user.id)).length;
        } catch {
          /* ignore */
        }
        return { id: p.id, name: p.name, updated_at: p.updated_at, file_count, owner_id: p.owner_id };
      }),
    );
    res.json({ projects: result });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const p = await projectService.create(req.user.id, req.body || {});
    res.status(201).json({ id: p.id, name: p.name });
  } catch (e) {
    next(e);
  }
});

function buildFileTree(paths) {
  const root = { children: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let parent = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const fullPath = parts.slice(0, i + 1).join('/');
      let node = parent.children.find((c) => c.path === fullPath);
      if (!node) {
        node = { name: parts[i], path: fullPath, type: 'folder', children: [] };
        parent.children.push(node);
      }
      parent = node;
    }
    parent.children.push({ name: parts[parts.length - 1], path: p, type: 'file' });
  }
  return root.children;
}

router.get('/:project_id', async (req, res, next) => {
  try {
    const p = await projectService.get(req.params.project_id, req.user.id);
    const fileList = await fileService.listFiles(req.params.project_id, req.user.id);
    const files = fileList.map((f) => f.path);
    const files_tree = buildFileTree(files);
    res.json({
      id: p.id,
      name: p.name,
      files,
      files_tree,
      main_file: p.main_file,
      compiler: p.compiler || 'pdflatex',
      updated_at: p.updated_at,
      owner_id: p.owner_id,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/collaborators', async (req, res, next) => {
  try {
    const list = await projectService.listCollaborators(req.params.project_id, req.user.id);
    res.json({ collaborators: await enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/collaborators', async (req, res, next) => {
  try {
    const list = await projectService.addCollaborator(req.params.project_id, req.user.id, req.body || {});
    res.status(201).json({ collaborators: await enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id/collaborators/:user_id', async (req, res, next) => {
  try {
    const list = await projectService.removeCollaborator(req.params.project_id, req.user.id, req.params.user_id);
    res.json({ collaborators: await enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/bib-keys', async (req, res, next) => {
  try {
    const data = await bibKeysService.getBibKeys(req.params.project_id, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.patch('/:project_id', async (req, res, next) => {
  try {
    const p = await projectService.update(req.params.project_id, req.user.id, req.body || {});
    res.json({ id: p.id, name: p.name, main_file: p.main_file, compiler: p.compiler || 'pdflatex' });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/clone', async (req, res, next) => {
  try {
    const p = await projectService.clone(req.params.project_id, req.user.id);
    res.status(201).json({ id: p.id, name: p.name });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/import-git', async (req, res, next) => {
  try {
    const { remote_url: remoteUrl } = req.body || {};
    if (!remoteUrl || typeof remoteUrl !== 'string') return res.status(400).json({ error: 'remote_url required' });
    await projectService.requireWriteAccess(req.params.project_id, req.user.id);
    if (!config.gitBridgeUrl) return res.status(503).json({ error: 'Git Bridge not configured' });
    const headers = { 'Content-Type': 'application/json' };
    if (config.gitBridgeApiKey) headers['X-Git-Bridge-Key'] = config.gitBridgeApiKey;
    const r = await fetch(`${config.gitBridgeUrl}/clone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: req.params.project_id,
        userId: req.user.id,
        remoteUrl: remoteUrl.trim(),
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status >= 500 ? 502 : r.status).json({ error: data.error || 'Import failed' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id', async (req, res, next) => {
  try {
    await projectService.remove(req.params.project_id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
