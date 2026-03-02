import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const config = {
  baseDir: rootDir,
  dataDir: process.env.DATA_DIR || path.join(rootDir, 'data'),
  get projectsDir() {
    const d = path.join(this.dataDir, 'projects');
    return d;
  },
  staticDir: path.join(rootDir, 'dist'),
  get templatesDir() {
    return path.join(rootDir, 'templates');
  },
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '1048576', 10),
  compileTimeoutSeconds: parseInt(process.env.COMPILE_TIMEOUT_SECONDS || '60', 10),
  secretKey: process.env.SECRET_KEY || 'change-me-in-production',
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],
  maxProjectsPerUser: parseInt(process.env.MAX_PROJECTS_PER_USER || '50', 10),
  useDockerCompile: process.env.USE_DOCKER_COMPILE === 'true',
  dockerTexImage: process.env.DOCKER_TEX_IMAGE || 'texlive/texlive:latest',
  useDatabase: process.env.USE_DATABASE === 'true',
};
