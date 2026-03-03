import { Router } from 'express';
import * as fileService from '../services/fileService.js';

const router = Router({ mergeParams: true });

router.get('/:project_id/files/*/history', async (req, res, next) => {
  const filePath = req.params[0]?.replace(/\/history$/, '') || req.params[0];
  if (!filePath) return next();
  try {
    const versions = await fileService.listHistory(req.params.project_id, req.user.id, filePath);
    res.json({ versions });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/files/*/history/:version_id', async (req, res, next) => {
  const filePath = req.params[0]?.replace(/\/history\/.*$/, '') || req.params[0];
  if (!filePath) return next();
  try {
    const content = await fileService.getHistoryContent(req.params.project_id, req.user.id, filePath, req.params.version_id);
    res.json({ content });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/files/*/restore', async (req, res, next) => {
  const filePath = req.params[0]?.replace(/\/restore$/, '') || req.params[0];
  if (!filePath) return next();
  try {
    const content = await fileService.restore(req.params.project_id, req.user.id, filePath, req.body?.version_id);
    res.json({ content });
  } catch (e) {
    next(e);
  }
});

export default router;
