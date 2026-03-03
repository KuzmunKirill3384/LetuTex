import { config } from '../config.js';

export function createFileStoreClient() {
  const baseUrl = config.fileStoreUrl || '';
  if (!baseUrl) return null;

  return {
    async upload(projectId, filePath, buffer) {
      const form = new FormData();
      form.append('projectId', projectId);
      form.append('path', filePath);
      form.append('file', new Blob([buffer]), pathBasename(filePath));
      const res = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `File Store upload failed: ${res.status}`);
      }
    },

    async download(projectId, filePath) {
      const u = new URL(`${baseUrl}/download`);
      u.searchParams.set('projectId', projectId);
      u.searchParams.set('path', filePath);
      const res = await fetch(u.toString());
      if (!res.ok) throw new Error('File not found');
      const buf = await res.arrayBuffer();
      return Buffer.from(buf);
    },

    async delete(projectId, filePath) {
      // Optional: File Store could support DELETE; for now we leave blob on disk
      // and rely on project delete cleanup or periodic cleanup
    },
  };
}

function pathBasename(p) {
  const i = p.replace(/\\/g, '/').lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}
