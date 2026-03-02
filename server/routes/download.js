import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { config } from '../config.js';
import * as projectService from '../services/projectService.js';
import { isProjectFile } from '../domain/validation.js';

const router = Router({ mergeParams: true });

router.get('/:project_id/download', (req, res, next) => {
  try {
    const proj = projectService.get(req.params.project_id, req.user.id);
    const root = path.join(config.projectsDir, req.params.project_id);

    const safeName = proj.name.replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    function addDir(dir, base) {
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith('.') || !isProjectFile(name)) continue;
        const full = path.join(dir, name);
        const rel = base ? `${base}/${name}` : name;
        if (fs.statSync(full).isDirectory()) {
          addDir(full, rel);
        } else {
          archive.file(full, { name: rel });
        }
      }
    }
    addDir(root, '');
    archive.finalize();
  } catch (e) {
    next(e);
  }
});

export default router;
