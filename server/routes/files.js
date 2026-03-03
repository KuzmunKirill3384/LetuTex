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

router.post('/:project_id/files', async (req, res, next) => {
  try {
    const { path: filePath, content } = req.body || {};
    await fileService.createFile(req.params.project_id, req.user.id, filePath, content || '');
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/search', async (req, res, next) => {
  try {
    const q = req.query.q ?? '';
    const results = await fileService.searchInProject(req.params.project_id, req.user.id, q);
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/folders', async (req, res, next) => {
  try {
    const { path: folderPath } = req.body || {};
    if (!folderPath) throw new BadRequestError('Folder path is required');
    await fileService.createFolder(req.params.project_id, req.user.id, folderPath);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/upload', upload.array('files', 20), async (req, res, next) => {
  try {
    const projectId = req.params.project_id;
    const targetDir = req.body?.path || '';
    const uploaded = [];
    for (const file of req.files || []) {
      const filePath = targetDir ? `${targetDir}/${file.originalname}` : file.originalname;
      await fileService.uploadFile(projectId, req.user.id, filePath, file.buffer);
      uploaded.push(filePath);
    }
    res.json({ ok: true, uploaded });
  } catch (e) {
    next(e);
  }
});

router.post('/:project_id/upload-zip', upload.single('file'), async (req, res, next) => {
  try {
    const projectId = req.params.project_id;
    await projectService.requireWriteAccess(projectId, req.user.id);
    if (!req.file) throw new BadRequestError('No ZIP file provided');

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const rootForValidation = config.projectsDir || path.sep;
    let currentStats = { fileCount: 0, totalSize: 0 };
    try {
      currentStats = await fileService.getProjectStats(projectId, req.user.id);
    } catch {
      /* new or no access */
    }
    const extracted = [];
    const maxFiles = config.maxProjectFiles;
    const maxSize = config.maxProjectSizeBytes;
    let totalSize = currentStats.totalSize;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (currentStats.fileCount + extracted.length >= maxFiles) break;

      let entryName = entry.entryName.replace(/\\/g, '/');
      if (entryName.startsWith('__MACOSX') || entryName.includes('.DS_Store')) continue;
      if (entryName.startsWith('.') || entryName.includes('/.')) continue;
      if (entryName.includes('..') || path.isAbsolute(entryName)) continue;
      if (/^[a-zA-Z]:/.test(entryName)) continue;

      try {
        validateUploadExtension(entryName);
        validatePathInsideProject(rootForValidation, entryName);
      } catch {
        continue;
      }

      const entryData = entry.getData();
      totalSize += entryData.length;
      if (totalSize > maxSize) break;

      if (config.useMongo) {
        await fileService.uploadFile(projectId, req.user.id, entryName, entryData);
      } else {
        const root = path.join(config.projectsDir, projectId);
        const full = path.join(root, entryName);
        const resolvedFull = path.resolve(full);
        const resolvedRoot = path.resolve(root);
        if (!resolvedFull.startsWith(resolvedRoot + path.sep)) continue;
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, entryData);
      }
      extracted.push(entryName);
    }

    res.json({ ok: true, extracted });
  } catch (e) {
    next(e);
  }
});

router.get('/:project_id/files/*', async (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    const content = await fileService.getContent(req.params.project_id, req.user.id, filePath);
    if (typeof content === 'object' && content.contentType) {
      return res.json({ content: content.content, content_type: content.contentType });
    }
    res.json({ content });
  } catch (e) {
    next(e);
  }
});

router.put('/:project_id/files/*', async (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    await fileService.save(req.params.project_id, req.user.id, filePath, req.body?.content ?? '');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:project_id/files/*', async (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    await fileService.deleteFile(req.params.project_id, req.user.id, filePath);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/:project_id/files/*', async (req, res, next) => {
  const filePath = req.params[0];
  if (!filePath) return next();
  try {
    await fileService.renameFile(req.params.project_id, req.user.id, filePath, req.body?.new_path);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
