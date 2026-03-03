import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { BadRequestError, NotFoundError } from '../exceptions.js';
import {
  validatePathInsideProject,
  validateFileExtension,
  validateUploadExtension,
  validateContentSize,
  isBinaryExtension,
} from '../domain/validation.js';

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.eps': 'image/eps', '.pdf': 'application/pdf', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp' };
  return mime[ext] || 'application/octet-stream';
}
import { createFileStore } from '../infrastructure/fileStore.js';
import { createFileStoreMongo } from '../infrastructure/fileStoreMongo.js';
import * as projectService from './projectService.js';

function _root(projectId) {
  const p = path.join(config.projectsDir, projectId);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new NotFoundError('Project not found');
  }
  return p;
}

function _rootForValidation() {
  return config.projectsDir || path.sep;
}

export async function listFiles(projectId, ownerId) {
  await projectService.get(projectId, ownerId);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    return store.listFiles();
  }
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.listFiles();
}

export async function getProjectStats(projectId, ownerId) {
  await projectService.get(projectId, ownerId);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    return store.getStats();
  }
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.getStats();
}

const SEARCH_EXT = new Set(['.tex', '.bib']);

export async function searchInProject(projectId, ownerId, query) {
  await projectService.get(projectId, ownerId);
  const store = config.useMongo ? createFileStoreMongo(projectId) : createFileStore(_root(projectId));
  const files = config.useMongo
    ? (await store.listFiles()).filter((f) => !f.is_dir && SEARCH_EXT.has(path.extname(f.path).toLowerCase()))
    : store.listFiles().filter((f) => !f.is_dir && SEARCH_EXT.has(path.extname(f.path).toLowerCase()));
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const results = [];
  const snippetLen = 80;
  for (const { path: filePath } of files) {
    let content;
    try {
      content = config.useMongo ? await store.read(filePath) : store.read(filePath);
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.toLowerCase().includes(q)) continue;
      const pos = line.toLowerCase().indexOf(q);
      const start = Math.max(0, pos - snippetLen / 2);
      const snippet = (start > 0 ? '…' : '') + line.slice(start, start + snippetLen) + (start + snippetLen < line.length ? '…' : '');
      results.push({ file: filePath, line: i + 1, snippet: snippet.trim() });
    }
  }
  return results.slice(0, 100);
}

export async function getContent(projectId, ownerId, filePath) {
  await projectService.get(projectId, ownerId);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo && config.fileStoreUrl) {
    const store = createFileStoreMongo(projectId);
    const { content, contentType } = await store.getFileWithType(filePath);
    if (contentType) {
      return { content: Buffer.isBuffer(content) ? content.toString('base64') : content, contentType };
    }
    return typeof content === 'string' ? content : content.toString('utf8');
  }
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    return store.read(filePath);
  }
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.read(filePath);
}

export async function save(projectId, ownerId, filePath, content, saveHistory = true) {
  await projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(filePath);
  validateContentSize(content, config.maxFileSizeBytes);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    await store.write(filePath, content, saveHistory);
    return;
  }
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  store.write(filePath, content, saveHistory);
}

export async function createFile(projectId, ownerId, filePath, content = '') {
  await projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(filePath);
  validateContentSize(content, config.maxFileSizeBytes);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    if (await store.exists(filePath)) throw new BadRequestError('File already exists');
    const stats = await store.getStats();
    if (stats.fileCount >= config.maxProjectFiles) throw new BadRequestError('Project file limit reached');
    const contentBytes = Buffer.byteLength(content, 'utf8');
    if (stats.totalSize + contentBytes > config.maxProjectSizeBytes) throw new BadRequestError('Project size limit reached');
    await store.write(filePath, content, false);
    return;
  }
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  if (store.exists(filePath)) throw new BadRequestError('File already exists');
  const stats = store.getStats();
  if (stats.fileCount >= config.maxProjectFiles) throw new BadRequestError('Project file limit reached');
  const contentBytes = Buffer.byteLength(content, 'utf8');
  if (stats.totalSize + contentBytes > config.maxProjectSizeBytes) throw new BadRequestError('Project size limit reached');
  store.write(filePath, content, false);
}

export async function deleteFile(projectId, ownerId, filePath) {
  await projectService.requireWriteAccess(projectId, ownerId);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    await store.delete(filePath);
    return;
  }
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  store.delete(filePath);
}

export async function renameFile(projectId, ownerId, filePath, newPath) {
  await projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(newPath);
  validatePathInsideProject(_rootForValidation(), filePath);
  validatePathInsideProject(_rootForValidation(), newPath);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    await store.rename(filePath, newPath);
    return;
  }
  const root = _root(projectId);
  const store = createFileStore(root);
  store.rename(filePath, newPath);
}

export async function listHistory(projectId, ownerId, filePath) {
  await projectService.get(projectId, ownerId);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo) return [];
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.listHistory(filePath);
}

export async function getHistoryContent(projectId, ownerId, filePath, versionId) {
  await projectService.get(projectId, ownerId);
  if (config.useMongo) throw new NotFoundError('Version not found');
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.getHistoryContent(filePath, versionId);
}

export async function restore(projectId, ownerId, filePath, versionId) {
  const content = await getHistoryContent(projectId, ownerId, filePath, versionId);
  await save(projectId, ownerId, filePath, content, false);
  return content;
}

export async function uploadFile(projectId, ownerId, filePath, buffer) {
  await projectService.requireWriteAccess(projectId, ownerId);
  validateUploadExtension(filePath);
  validatePathInsideProject(_rootForValidation(), filePath);
  if (config.useMongo) {
    const store = createFileStoreMongo(projectId);
    const stats = await store.getStats();
    if (stats.fileCount >= config.maxProjectFiles) throw new BadRequestError('Project file limit reached');
    if (stats.totalSize + buffer.length > config.maxProjectSizeBytes) throw new BadRequestError('Project size limit reached');
    if (isBinaryExtension(filePath) && config.fileStoreUrl) {
      await store.write(filePath, buffer, false, { binary: true, contentType: contentTypeFromPath(filePath) });
    } else {
      await store.write(filePath, buffer.toString('utf8'), false);
    }
    return;
  }
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  const stats = store.getStats();
  if (stats.fileCount >= config.maxProjectFiles) throw new BadRequestError('Project file limit reached');
  if (stats.totalSize + buffer.length > config.maxProjectSizeBytes) throw new BadRequestError('Project size limit reached');
  const full = path.join(root, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
}

export async function createFolder(projectId, ownerId, folderPath) {
  await projectService.requireWriteAccess(projectId, ownerId);
  validatePathInsideProject(_rootForValidation(), folderPath + '/x');
  if (config.useMongo) return;
  const root = _root(projectId);
  const full = path.join(root, folderPath);
  fs.mkdirSync(full, { recursive: true });
}
