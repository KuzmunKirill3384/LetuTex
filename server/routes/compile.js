import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import * as compileService from '../services/compileService.js';
import * as projectService from '../services/projectService.js';
import * as synctexService from '../services/synctexService.js';
import * as definitionsService from '../services/definitionsService.js';
import { config } from '../config.js';
import { NotFoundError } from '../exceptions.js';

const router = Router({ mergeParams: true });

router.post('/:project_id/compile', async (req, res, next) => {
  try {
    const result = await compileService.compile(req.params.project_id, req.user.id);
    const pdfUrl = result.success ? `/api/projects/${req.params.project_id}/output.pdf` : null;
    res.json({ success: result.success, pdf_url: pdfUrl, log: result.log, errors: result.errors, hasWarnings: result.hasWarnings });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/output.pdf', (req, res, next) => {
  try {
    const proj = projectService.get(req.params.project_id, req.user.id);
    const root = path.join(config.projectsDir, req.params.project_id);
    const pdfName = path.basename(proj.main_file, path.extname(proj.main_file)) + '.pdf';
    const pdfPath = path.join(root, pdfName);
    if (!fs.existsSync(pdfPath)) throw new NotFoundError('PDF not found. Compile first.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(pdfPath);
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/synctex-inverse', (req, res, next) => {
  try {
    const { page, x, y } = req.query;
    const result = synctexService.synctexInverse(req.params.project_id, req.user.id, page, x, y);
    if (!result) return res.status(404).json({ error: 'SyncTeX inverse not available or no match' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/definitions', (req, res, next) => {
  try {
    const data = definitionsService.getDefinitions(req.params.project_id, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
