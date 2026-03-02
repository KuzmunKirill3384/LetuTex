import { Router } from 'express';
import * as projectService from '../services/projectService.js';
import * as fileService from '../services/fileService.js';
import * as bibKeysService from '../services/bibKeysService.js';
import { getById } from '../infrastructure/userStore.js';

const router = Router({ mergeParams: true });

function enrichCollaborators(list) {
  return list.map((c) => {
    const u = getById(c.user_id);
    return { user_id: c.user_id, role: c.role, display_name: u?.display_name || u?.username || c.user_id };
  });
}

router.get('/', (req, res, next) => {
  try {
    const projects = projectService.listAccessible(req.user.id);
    const result = projects.map((p) => {
      let file_count = 0;
      try {
        file_count = fileService.listFiles(p.id, req.user.id).length;
      } catch {
        /* ignore */
      }
      return { id: p.id, name: p.name, updated_at: p.updated_at, file_count, owner_id: p.owner_id };
    });
    res.json({ projects: result });
  } catch (e) {
    next(e);
  }
});

router.post('/', (req, res, next) => {
  try {
    const p = projectService.create(req.user.id, req.body || {});
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

router.get('/:project_id', (req, res, next) => {
  try {
    const p = projectService.get(req.params.project_id, req.user.id);
    const fileList = fileService.listFiles(req.params.project_id, req.user.id);
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

router.get('/:project_id/collaborators', (req, res, next) => {
  try {
    const list = projectService.listCollaborators(req.params.project_id, req.user.id);
    res.json({ collaborators: enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/collaborators', (req, res, next) => {
  try {
    const list = projectService.addCollaborator(req.params.project_id, req.user.id, req.body || {});
    res.status(201).json({ collaborators: enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id/collaborators/:user_id', (req, res, next) => {
  try {
    const list = projectService.removeCollaborator(req.params.project_id, req.user.id, req.params.user_id);
    res.json({ collaborators: enrichCollaborators(list) });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/bib-keys', (req, res, next) => {
  try {
    const data = bibKeysService.getBibKeys(req.params.project_id, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.patch('/:project_id', (req, res, next) => {
  try {
    const p = projectService.update(req.params.project_id, req.user.id, req.body || {});
    res.json({ id: p.id, name: p.name, main_file: p.main_file, compiler: p.compiler || 'pdflatex' });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/clone', (req, res, next) => {
  try {
    const p = projectService.clone(req.params.project_id, req.user.id);
    res.status(201).json({ id: p.id, name: p.name });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id', (req, res, next) => {
  try {
    projectService.remove(req.params.project_id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
