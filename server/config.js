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
  get outputsDir() {
    return path.join(this.dataDir, 'outputs');
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
  maxProjectFiles: parseInt(process.env.MAX_PROJECT_FILES || '1000', 10),
  maxProjectSizeBytes: parseInt(process.env.MAX_PROJECT_SIZE_BYTES || '52428800', 10),
  useDockerCompile: process.env.USE_DOCKER_COMPILE === 'true',
  dockerTexImage: process.env.DOCKER_TEX_IMAGE || 'texlive/texlive:latest',
  useDatabase: process.env.USE_DATABASE === 'true',
  useMongo: !!process.env.MONGO_URI,
  mongoUri: process.env.MONGO_URI || '',
  redisUri: process.env.REDIS_URI || '',
  jwtSecret: process.env.JWT_SECRET || process.env.SECRET_KEY || 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  documentUpdaterUrl: process.env.DOCUMENT_UPDATER_URL || 'http://localhost:8001',
  clsiUrl: process.env.CLSI_URL || '',
  clsiApiKey: process.env.CLSI_API_KEY || '',
  fileStoreUrl: process.env.FILE_STORE_URL || '',
  gitBridgeUrl: process.env.GIT_BRIDGE_URL || '',
  gitBridgeApiKey: process.env.GIT_BRIDGE_API_KEY || '',
};
