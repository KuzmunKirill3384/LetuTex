import path from 'path';
import { connectMongo } from './mongoClient.js';
import { createFileStoreClient } from './fileStoreClient.js';
import { NotFoundError } from '../exceptions.js';
import { isProjectFile } from '../domain/validation.js';

const BINARY_CONTENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/eps', 'application/pdf',
  'image/tiff', 'image/bmp',
]);

function isBinaryContentType(ct) {
  if (!ct) return false;
  return BINARY_CONTENT_TYPES.has(ct) || ct.startsWith('image/');
}

export function createFileStoreMongo(projectId) {
  const fileStore = createFileStoreClient();

  async function filesColl() {
    const db = await connectMongo();
    return db.collection('project_files');
  }

  return {
    async getStats() {
      const coll = await filesColl();
      const docs = await coll.find({ project_id: projectId }).toArray();
      let totalSize = 0;
      for (const d of docs) {
        if (isBinaryContentType(d.content_type)) continue;
        totalSize += Buffer.byteLength(d.content || '', 'utf8');
      }
      return { fileCount: docs.length, totalSize };
    },

    async listFiles() {
      const coll = await filesColl();
      const docs = await coll.find({ project_id: projectId }).toArray();
      const result = [];
      const seen = new Set();
      for (const d of docs) {
        const filePath = d.path.replace(/\\/g, '/');
        result.push({ path: filePath, name: path.basename(filePath), is_dir: false });
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join('/');
          if (!seen.has(dirPath)) {
            seen.add(dirPath);
            result.push({ path: dirPath, name: parts[i - 1], is_dir: true });
          }
        }
      }
      result.sort((a, b) => (a.path < b.path ? -1 : 1));
      return result;
    },

    async read(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      const doc = await coll.findOne({ project_id: projectId, path: normalized });
      if (!doc) throw new NotFoundError('File not found');
      if (isBinaryContentType(doc.content_type)) return '';
      return doc.content || '';
    },

    async write(filePath, content, _saveHistoryFlag = true, opts = {}) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      if (opts.binary && Buffer.isBuffer(content) && fileStore) {
        await fileStore.upload(projectId, normalized, content);
        await coll.updateOne(
          { project_id: projectId, path: normalized },
          { $set: { content: '', content_type: opts.contentType || 'application/octet-stream', updated_at: new Date().toISOString() } },
          { upsert: true },
        );
        return;
      }
      await coll.updateOne(
        { project_id: projectId, path: normalized },
        { $set: { content: typeof content === 'string' ? content : '', updated_at: new Date().toISOString() }, $unset: { content_type: 1 } },
        { upsert: true },
      );
    },

    async delete(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      await coll.deleteOne({ project_id: projectId, path: normalized });
    },

    async exists(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      const doc = await coll.findOne({ project_id: projectId, path: normalized }, { projection: { _id: 1 } });
      return !!doc;
    },

    async rename(oldPath, newPath) {
      const oldNorm = oldPath.replace(/\\/g, '/');
      const newNorm = newPath.replace(/\\/g, '/');
      const coll = await filesColl();
      const doc = await coll.findOne({ project_id: projectId, path: oldNorm });
      if (!doc) throw new NotFoundError('File not found');
      await coll.deleteOne({ project_id: projectId, path: oldNorm });
      await coll.insertOne({
        project_id: projectId,
        path: newNorm,
        content: doc.content ?? '',
        content_type: doc.content_type,
        updated_at: new Date().toISOString(),
      });
    },

    async listHistory(_filePath) {
      return [];
    },

    async getHistoryContent(_filePath, _versionId) {
      throw new NotFoundError('Version not found');
    },

    async getFileWithType(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      const doc = await coll.findOne({ project_id: projectId, path: normalized });
      if (!doc) throw new NotFoundError('File not found');
      if (isBinaryContentType(doc.content_type) && fileStore) {
        const buf = await fileStore.download(projectId, normalized);
        return { content: buf, contentType: doc.content_type };
      }
      return { content: doc.content || '', contentType: null };
    },

    async getDoc(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const coll = await filesColl();
      const doc = await coll.findOne({ project_id: projectId, path: normalized });
      return doc;
    },
  };
}

export async function materializeProjectToDir(projectId, targetDir) {
  const store = createFileStoreMongo(projectId);
  const fs = await import('fs');
  const pathMod = await import('path');
  const files = await store.listFiles();
  for (const f of files) {
    if (f.is_dir) continue;
    if (!isProjectFile(f.name)) continue;
    const full = pathMod.join(targetDir, f.path);
    fs.mkdirSync(pathMod.dirname(full), { recursive: true });
    const { content, contentType } = await store.getFileWithType(f.path);
    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(full, content);
    } else {
      fs.writeFileSync(full, content, 'utf8');
    }
  }
}
