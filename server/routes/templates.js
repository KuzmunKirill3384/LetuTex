import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  const dir = config.templatesDir;
  if (!fs.existsSync(dir)) return res.json({ templates: [] });

  const templates = [];
  for (const name of fs.readdirSync(dir)) {
    const d = path.join(dir, name);
    if (!fs.statSync(d).isDirectory()) continue;

    let meta = { id: name, name, description: '', main_file: 'main.tex' };
    const manifest = path.join(d, 'manifest.json');
    if (fs.existsSync(manifest)) {
      try {
        const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        meta = {
          id: name,
          name: data.name || name,
          description: data.description || '',
          main_file: data.main_file || 'main.tex',
        };
      } catch {
        /* malformed manifest */
      }
    }
    templates.push(meta);
  }
  res.json({ templates });
});

export default router;
