import { connectMongo } from './mongoClient.js';
import { NotFoundError } from '../exceptions.js';

async function projectsColl() {
  const db = await connectMongo();
  return db.collection('projects');
}

export async function listIdsByOwner(ownerId) {
  const coll = await projectsColl();
  const docs = await coll.find({ owner_id: ownerId }).project({ id: 1 }).toArray();
  return docs.map((d) => d.id);
}

export async function getCollaborators(projectId) {
  const p = await get(projectId);
  return p.collaborators || [];
}

export async function addCollaborator(projectId, userId, role) {
  const coll = await projectsColl();
  const list = ((await get(projectId)).collaborators || []).filter((c) => c.user_id !== userId);
  if (!['read', 'write'].includes(role)) role = 'read';
  list.push({ user_id: userId, role });
  const r = await coll.updateOne({ id: projectId }, { $set: { collaborators: list, updated_at: new Date().toISOString() } });
  if (r.matchedCount === 0) throw new NotFoundError('Project not found');
}

export async function removeCollaborator(projectId, userId) {
  const coll = await projectsColl();
  const p = await get(projectId);
  const list = (p.collaborators || []).filter((c) => c.user_id !== userId);
  await coll.updateOne({ id: projectId }, { $set: { collaborators: list, updated_at: new Date().toISOString() } });
}

export async function listIdsWhereCollaborator(userId) {
  const coll = await projectsColl();
  const docs = await coll.find({ collaborators: { $elemMatch: { user_id: userId } } }).project({ id: 1 }).toArray();
  return docs.map((d) => d.id);
}

export async function get(projectId) {
  const coll = await projectsColl();
  const doc = await coll.findOne({ id: projectId });
  if (!doc) throw new NotFoundError('Project not found');
  return {
    id: doc.id,
    name: doc.name,
    owner_id: doc.owner_id,
    main_file: doc.main_file || 'main.tex',
    compiler: doc.compiler || 'pdflatex',
    updated_at: doc.updated_at || new Date().toISOString(),
    collaborators: doc.collaborators || [],
  };
}

export async function create(projectId, name, ownerId, mainFile = 'main.tex') {
  const coll = await projectsColl();
  await coll.insertOne({
    id: projectId,
    name: (name || 'Untitled').trim(),
    owner_id: ownerId,
    main_file: mainFile,
    compiler: 'pdflatex',
    updated_at: new Date().toISOString(),
    collaborators: [],
  });
  return get(projectId);
}

export async function updateMainFile(projectId, mainFile) {
  const coll = await projectsColl();
  await coll.updateOne(
    { id: projectId },
    { $set: { main_file: mainFile, updated_at: new Date().toISOString() } },
  );
}

export async function updateCompiler(projectId, compiler) {
  const VALID = new Set(['pdflatex', 'xelatex', 'lualatex']);
  const coll = await projectsColl();
  await coll.updateOne(
    { id: projectId },
    { $set: { compiler: VALID.has(compiler) ? compiler : 'pdflatex', updated_at: new Date().toISOString() } },
  );
}

export async function updateName(projectId, name) {
  const coll = await projectsColl();
  await coll.updateOne(
    { id: projectId },
    { $set: { name: (name || 'Untitled').trim(), updated_at: new Date().toISOString() } },
  );
}

export async function remove(projectId) {
  const db = (await connectMongo());
  const projects = db.collection('projects');
  const files = db.collection('project_files');
  await projects.deleteOne({ id: projectId });
  await files.deleteMany({ project_id: projectId });
}

export async function exists(projectId) {
  const coll = await projectsColl();
  const doc = await coll.findOne({ id: projectId }, { projection: { id: 1 } });
  return !!doc;
}

export async function countByOwner(ownerId) {
  const coll = await projectsColl();
  return coll.countDocuments({ owner_id: ownerId });
}
