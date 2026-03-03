import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { materializeProjectToDir } from '../infrastructure/fileStoreMongo.js';
import { run as runCompile } from '../infrastructure/compileRunner.js';
import * as projectRepository from '../infrastructure/projectRepositoryMongo.js';
import { connectMongo } from '../infrastructure/mongoClient.js';
import { config } from '../config.js';
import { parseLatexErrors } from '../domain/validation.js';

const app = express();
app.use(express.json({ limit: '512kb' }));

const clsiApiKey = process.env.CLSI_API_KEY || '';
const outputsDir = config.outputsDir;
const documentUpdaterUrl = process.env.DOCUMENT_UPDATER_URL || config.documentUpdaterUrl || 'http://localhost:8001';

function hasWriteAccess(project, userId) {
  if (project.owner_id === userId) return true;
  const collab = (project.collaborators || []).find((c) => c.user_id === userId);
  return collab?.role === 'write';
}

app.post('/compile', async (req, res) => {
  if (clsiApiKey && req.headers['x-clsi-key'] !== clsiApiKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const { projectId, userId } = req.body || {};
  if (!projectId || !userId) {
    return res.status(400).json({ success: false, error: 'projectId and userId required' });
  }
  let tempDir = null;
  try {
    const proj = await projectRepository.get(projectId);
    if (!hasWriteAccess(proj, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (documentUpdaterUrl) {
      await fetch(`${documentUpdaterUrl}/doc/flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      }).catch(() => {});
    }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `clsi-${projectId}-`));
    await materializeProjectToDir(projectId, tempDir);
    const result = await runCompile(tempDir, proj.main_file || 'main.tex', proj.compiler || 'pdflatex');
    if (result.success) {
      const pdfName = path.basename(proj.main_file || 'main.tex', path.extname(proj.main_file || 'main.tex')) + '.pdf';
      const base = path.basename(proj.main_file || 'main.tex', path.extname(proj.main_file || 'main.tex'));
      const outDir = path.join(outputsDir, projectId);
      fs.mkdirSync(outDir, { recursive: true });
      const srcPdf = path.join(tempDir, pdfName);
      const outPdf = path.join(outDir, pdfName);
      if (fs.existsSync(srcPdf)) fs.copyFileSync(srcPdf, outPdf);
      const srcSynctex = path.join(tempDir, base + '.synctex.gz');
      const outSynctex = path.join(outDir, base + '.synctex.gz');
      if (fs.existsSync(srcSynctex)) fs.copyFileSync(srcSynctex, outSynctex);
    }
    res.json({
      success: result.success,
      log: result.log || '',
      errors: result.errors || parseLatexErrors(result.log || ''),
      hasWarnings: result.hasWarnings || false,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message || 'Compilation failed',
      log: '',
      errors: [],
    });
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = parseInt(process.env.CLSI_PORT || '8003', 10);

async function main() {
  if (config.mongoUri) {
    await connectMongo();
  }
  app.listen(port, () => {
    console.log(`CLSI http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
