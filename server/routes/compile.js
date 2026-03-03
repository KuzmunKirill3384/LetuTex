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

router.get('/:project_id/output.pdf', async (req, res, next) => {
  try {
    const proj = await projectService.get(req.params.project_id, req.user.id);
    const projectId = req.params.project_id;
    let pdfPath;
    if (config.useMongo) {
      const pdfName = path.basename(proj.main_file, path.extname(proj.main_file)) + '.pdf';
      pdfPath = path.join(config.outputsDir, projectId, pdfName);
    } else {
      const root = path.join(config.projectsDir, projectId);
      const pdfName = path.basename(proj.main_file, path.extname(proj.main_file)) + '.pdf';
      pdfPath = path.join(root, pdfName);
    }
    if (!fs.existsSync(pdfPath)) throw new NotFoundError('PDF not found. Compile first.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(pdfPath);
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/synctex-inverse', async (req, res, next) => {
  try {
    const { page, x, y } = req.query;
    const result = await synctexService.synctexInverse(req.params.project_id, req.user.id, page, x, y);
    if (!result) return res.status(404).json({ error: 'SyncTeX inverse not available or no match' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/synctex-forward', async (req, res, next) => {
  try {
    const { file, line, column } = req.query;
    const result = await synctexService.synctexForward(
      req.params.project_id,
      req.user.id,
      file || '',
      line,
      column,
    );
    if (!result) return res.status(404).json({ error: 'SyncTeX forward not available or no match' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/definitions', async (req, res, next) => {
  try {
    const data = await definitionsService.getDefinitions(req.params.project_id, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
