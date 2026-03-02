import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { BadRequestError, NotFoundError } from '../exceptions.js';
import {
  validatePathInsideProject,
  validateFileExtension,
  validateUploadExtension,
  validateContentSize,
} from '../domain/validation.js';
import { createFileStore } from '../infrastructure/fileStore.js';
import * as projectService from './projectService.js';

function _root(projectId) {
  const p = path.join(config.projectsDir, projectId);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new NotFoundError('Project not found');
  }
  return p;
}

export function listFiles(projectId, ownerId) {
  projectService.get(projectId, ownerId);
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.listFiles();
}

export function getContent(projectId, ownerId, filePath) {
  projectService.get(projectId, ownerId);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  return store.read(filePath);
}

export function save(projectId, ownerId, filePath, content, saveHistory = true) {
  projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(filePath);
  validateContentSize(content, config.maxFileSizeBytes);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  store.write(filePath, content, saveHistory);
}

export function createFile(projectId, ownerId, filePath, content = '') {
  projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(filePath);
  validateContentSize(content, config.maxFileSizeBytes);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  if (store.exists(filePath)) throw new BadRequestError('File already exists');
  store.write(filePath, content, false);
}

export function deleteFile(projectId, ownerId, filePath) {
  projectService.requireWriteAccess(projectId, ownerId);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  store.delete(filePath);
}

export function renameFile(projectId, ownerId, filePath, newPath) {
  projectService.requireWriteAccess(projectId, ownerId);
  validateFileExtension(newPath);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  validatePathInsideProject(root, newPath);
  const store = createFileStore(root);
  store.rename(filePath, newPath);
}

export function listHistory(projectId, ownerId, filePath) {
  projectService.get(projectId, ownerId);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const store = createFileStore(root);
  return store.listHistory(filePath);
}

export function getHistoryContent(projectId, ownerId, filePath, versionId) {
  projectService.get(projectId, ownerId);
  const root = _root(projectId);
  const store = createFileStore(root);
  return store.getHistoryContent(filePath, versionId);
}

export function restore(projectId, ownerId, filePath, versionId) {
  const content = getHistoryContent(projectId, ownerId, filePath, versionId);
  save(projectId, ownerId, filePath, content, false);
  return content;
}

export function uploadFile(projectId, ownerId, filePath, buffer) {
  projectService.requireWriteAccess(projectId, ownerId);
  validateUploadExtension(filePath);
  const root = _root(projectId);
  validatePathInsideProject(root, filePath);
  const full = path.join(root, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
}

export function createFolder(projectId, ownerId, folderPath) {
  projectService.requireWriteAccess(projectId, ownerId);
  const root = _root(projectId);
  validatePathInsideProject(root, folderPath + '/x');
  const full = path.join(root, folderPath);
  fs.mkdirSync(full, { recursive: true });
}
