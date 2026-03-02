import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import * as projectService from './projectService.js';

/**
 * Inverse SyncTeX: (page, x, y) in PDF → (file, line) in source.
 * Uses system `synctex` CLI if available; otherwise returns null.
 * Coordinates x, y are in PDF points (1/72 inch); origin bottom-left per PDF convention.
 */
export function synctexInverse(projectId, userId, page, x, y) {
  const proj = projectService.get(projectId, userId);
  const root = path.join(config.projectsDir, projectId);
  const mainFile = proj.main_file || 'main.tex';
  const base = path.basename(mainFile, path.extname(mainFile));
  const pdfName = base + '.pdf';
  const pdfPath = path.join(root, pdfName);
  const synctexGz = path.join(root, base + '.synctex.gz');
  if (!fs.existsSync(pdfPath) || !fs.existsSync(synctexGz)) return null;
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const xNum = Math.round(parseFloat(String(x)) || 0);
  const yNum = Math.round(parseFloat(String(y)) || 0);
  let out = '';
  try {
    out = execSync(`synctex view -i "${pageNum}:${xNum}:${yNum}:${pdfName}" -o "${base}"`, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 65536,
      timeout: 5000,
    });
  } catch {
    return null;
  }
  const fileMatch = out.match(/File:\s*(.+?)(?:\s*[\r\n]|$)/i);
  const lineMatch = out.match(/Line:\s*(\d+)/i);
  if (fileMatch && lineMatch) {
    let file = fileMatch[1].trim();
    if (!path.isAbsolute(file)) file = path.normalize(path.join(root, file));
    const rel = path.relative(root, file);
    return { file: rel.replace(/\\/g, '/'), line: parseInt(lineMatch[1], 10) };
  }
  return null;
}
