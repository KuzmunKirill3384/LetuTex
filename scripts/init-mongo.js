// MongoDB init script for LetuTEX (runs when volume is empty)
// Stage 1 will use: users, projects, project_files

const db = db.getSiblingDB('letutex');

db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });

db.createCollection('projects');
db.projects.createIndex({ owner_id: 1 });
db.projects.createIndex({ updated_at: -1 });

db.createCollection('project_files');
db.project_files.createIndex({ project_id: 1, path: 1 }, { unique: true });
db.project_files.createIndex({ project_id: 1 });
