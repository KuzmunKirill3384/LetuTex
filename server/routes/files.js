import { Router } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import * as fileService from '../services/fileService.js';
import * as projectService from '../services/projectService.js';
import { config } from '../config.js';
import { validateUploadExtension, validatePathInsideProject } from '../domain/validation.js';
import { BadRequestError } from '../exceptions.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router({ mergeParams: true });

router.post('/:project_id/files', (req, res, next) => {
  try {
    const { path: filePath, content } = req.body || {};
    fileService.createFile(req.params.project_id, req.user.id, filePath, content || '');
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/folders', (req, res, next) => {
  try {
    const { path: folderPath } = req.body || {};
    if (!folderPath) throw new BadRequestError('Folder path is required');
    fileService.createFolder(req.params.project_id, req.user.id, folderPath);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/upload', upload.array('files', 20), (req, res, next) => {
  try {
    const projectId = req.params.project_id;
    const targetDir = req.body?.path || '';
    const uploaded = [];
    for (const file of req.files || []) {
      const filePath = targetDir ? `${targetDir}/${file.originalname}` : file.originalname;
      fileService.uploadFile(projectId, req.user.id, filePath, file.buffer);
      uploaded.push(filePath);
    }
    res.json({ ok: true, uploaded });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/upload-zip', upload.single('file'), (req, res, next) => {
  try {
    const projectId = req.params.project_id;
    projectService.requireWriteAccess(projectId, req.user.id);
    if (!req.file) throw new BadRequestError('No ZIP file provided');

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const root = path.join(config.projectsDir, projectId);
    const extracted = [];
    const MAX_EXTRACTED_FILES = 500;
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
    let totalSize = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (extracted.length >= MAX_EXTRACTED_FILES) break;

      let entryName = entry.entryName.replace(/\\/g, '/');
      if (entryName.startsWith('__MACOSX') || entryName.includes('.DS_Store')) continue;
      if (entryName.startsWith('.') || entryName.includes('/.')) continue;
      if (entryName.includes('..') || path.isAbsolute(entryName)) continue;
      if (/^[a-zA-Z]:/.test(entryName)) continue;

      try {
        validateUploadExtension(entryName);
        validatePathInsideProject(root, entryName);
      } catch {
        continue;
      }

      const entryData = entry.getData();
      totalSize += entryData.length;
      if (totalSize > MAX_TOTAL_SIZE) break;

      const full = path.join(root, entryName);
      const resolvedFull = path.resolve(full);
      const resolvedRoot = path.resolve(root);
      if (!resolvedFull.startsWith(resolvedRoot + path.sep)) continue;

      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, entryData);
      extracted.push(entryName);
    }

    res.json({ ok: true, extracted });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/files/*', (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    const content = fileService.getContent(req.params.project_id, req.user.id, filePath);
    res.json({ content });
  } catch (e) {
    next(e);
  }
});

router.put('/:project_id/files/*', (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    fileService.save(req.params.project_id, req.user.id, filePath, req.body?.content ?? '');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id/files/*', (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    fileService.deleteFile(req.params.project_id, req.user.id, filePath);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/:project_id/files/*', (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    fileService.renameFile(req.params.project_id, req.user.id, filePath, req.body?.new_path);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
