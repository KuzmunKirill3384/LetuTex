<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
import AceEditor from '@/components/AceEditor.vue';
import LatexToolbar from '@/components/LatexToolbar.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import PdfPreviewSync from '@/components/PdfPreviewSync.vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import SegmentControl from '@/components/SegmentControl.vue';
import { useAuth } from '@/composables/useAuth.js';
import { useRealtime } from '@/composables/useRealtime.js';
import { useEditor } from '@/composables/useEditor.js';
import { useCustomSnippets } from '@/composables/useCustomSnippets.js';
import { api } from '@/composables/useApi.js';
import { useToast } from '@/composables/useToast.js';

const { user, displayName, logout } = useAuth();
const realtime = useRealtime();
const { customSnippets, addSnippet } = useCustomSnippets();
const { success, error: showError } = useToast();
const isProjectOwner = computed(() => currentProjectData.value?.owner_id === user.value?.id);
const router = useRouter();
const route = useRoute();
const aceRef = ref(null);

const {
  projects,
  currentProjectId,
  currentProjectData,
  currentFiles,
  currentFile,
  mainFile,
  compiler,
  editorContent,
  cursorPos,
  dirty,
  compileBusy,
  autoCompile,
  autoCompileInterval,
  statusMsg,
  statusType,
  showPreview,
  pdfUrl,
  logText,
  logErrors,
  logVisible,
  logFilter,
  currentProjectName,
  filteredLogLines,
  fileIcon,
  isLogError,
  loadProjects,
  selectProject,
  selectFile,
  saveCurrentFile,
  onEditorChange,
  compile,
  refreshFiles,
  setMainFile,
  setCompiler,
  renameProject,
  cleanup,
  sendRealtimeOp,
} = useEditor(realtime);

const viewMode = ref('split');
const sidebarCollapsed = ref(false);
const ctxMenu = ref({ show: false, x: 0, y: 0, file: '' });
const _fileLoading = ref(false);

const showNewProjectModal = ref(false);
const newProjName = ref('Новый проект');
const templates = ref([]);
const creatingProject = ref(false);

const showNewFileModal = ref(false);
const newFilePath = ref('new.tex');
const showRenameModal = ref(false);
const renameTarget = ref('');
const renameValue = ref('');
const showDeleteConfirm = ref(false);
const deleteTarget = ref('');
const showDeleteProjectConfirm = ref(false);
const showRenameProjectModal = ref(false);
const renameProjectValue = ref('');
const showCollaboratorsModal = ref(false);
const collaborators = ref([]);
const newCollaboratorId = ref('');
const newCollaboratorRole = ref('write');
const collaboratorsLoading = ref(false);
const addCollaboratorBusy = ref(false);
const definitionsCache = ref({});
const bibKeys = ref([]);
const syncPdfPage = ref(0);
let syncForwardTimer = null;

const showHistoryModal = ref(false);
const historyVersions = ref([]);
const showShortcutsModal = ref(false);
const showQuickOpen = ref(false);
const quickFilter = ref('');
const logFullscreen = ref(false);
const outlineCollapsed = ref(false);
const showNewFolderModal = ref(false);
const newFolderPath = ref('');
const showAddSnippetModal = ref(false);
const snippetLabel = ref('');
const snippetText = ref('');
const dragOver = ref(false);
const showSearchModal = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const searchBusy = ref(false);
const ONBOARDING_KEY = 'leti_onboarding_seen';
const showOnboardingHint = ref(false);
const expandedFolders = ref(new Set());

watch(
  currentFiles,
  (files) => {
    const folders = new Set();
    for (const f of files) {
      const parts = f.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        folders.add(parts.slice(0, i + 1).join('/'));
      }
    }
    expandedFolders.value = folders;
  },
  { immediate: true },
);

async function fetchBibKeys() {
  if (!currentProjectId.value) return;
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/bib-keys`);
    bibKeys.value = data.keys || [];
  } catch {
    bibKeys.value = [];
  }
}

watch(currentProjectId, (id) => {
  if (id) {
    fetchDefinitions();
    fetchBibKeys();
  }
});

function toggleFolder(folderPath) {
  const next = new Set(expandedFolders.value);
  if (next.has(folderPath)) next.delete(folderPath);
  else next.add(folderPath);
  expandedFolders.value = next;
}

const fileTreeItems = computed(() => {
  const paths = [...currentFiles.value].sort();
  const items = [];
  const addedFolders = new Set();
  const expanded = expandedFolders.value;
  for (const filePath of paths) {
    const parts = filePath.split('/');
    let visible = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const fp = parts.slice(0, i + 1).join('/');
      if (i > 0) {
        const parent = parts.slice(0, i).join('/');
        if (!expanded.has(parent)) {
          visible = false;
          break;
        }
      }
      if (!addedFolders.has(fp) && visible) {
        addedFolders.add(fp);
        items.push({ type: 'folder', path: fp, name: parts[i], depth: i, expanded: expanded.has(fp) });
      }
      if (!expanded.has(fp)) {
        visible = false;
        break;
      }
    }
    if (!visible) continue;
    items.push({ type: 'file', path: filePath, name: parts[parts.length - 1], depth: parts.length - 1 });
  }
  return items;
});

function folderIcon(expanded) {
  return expanded ? 'M1 4l3-3h5l1 1h4l1 1v1H1z M1 4v6h14V4H1z' : 'M1 4l3-3h5l1 1h4l1 1v7H1V4z';
}

function findClosingBrace(str, start) {
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const documentOutline = computed(() => {
  const content = editorContent.value || '';
  const name = currentFile.value || '';
  if (!/\.tex$/i.test(name)) return [];
  const re = /\\(part|chapter|section|subsection|subsubsection)\s*\*?\s*(?:\[[^\]]*\])?\s*\{/g;
  const entries = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const openIdx = content.indexOf('{', m.index);
    if (openIdx === -1) continue;
    const closeIdx = findClosingBrace(content, openIdx);
    if (closeIdx === -1) continue;
    const title = content
      .slice(openIdx + 1, closeIdx)
      .replace(/\s+/g, ' ')
      .trim();
    const line = content.slice(0, m.index).split('\n').length;
    const levelMap = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4 };
    entries.push({ level: levelMap[m[1]] ?? 2, title: title || m[1], line });
  }
  return entries;
});

const quickOpenFiles = computed(() => {
  if (!quickFilter.value) return currentFiles.value;
  const q = quickFilter.value.toLowerCase();
  return currentFiles.value.filter((f) => f.toLowerCase().includes(q));
});

function onCursorChange(pos) {
  cursorPos.value = pos;
  if (syncForwardTimer) clearTimeout(syncForwardTimer);
  syncForwardTimer = setTimeout(() => syncEditorToPdf(), 400);
}

async function syncEditorToPdf() {
  if (!currentProjectId.value || !currentFile.value || !cursorPos.value?.line) return;
  const ext = (currentFile.value.split('.').pop() || '').toLowerCase();
  if (ext !== 'tex' && ext !== 'sty' && ext !== 'cls') return;
  try {
    const data = await api(
      `/api/projects/${currentProjectId.value}/synctex-forward?file=${encodeURIComponent(currentFile.value)}&line=${cursorPos.value.line}&column=${cursorPos.value.col || 1}`,
    );
    if (data?.page) syncPdfPage.value = data.page;
  } catch {
    syncPdfPage.value = 0;
  }
}

async function doSearch() {
  if (!currentProjectId.value || !searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchBusy.value = true;
  try {
    const data = await api(
      `/api/projects/${currentProjectId.value}/search?q=${encodeURIComponent(searchQuery.value.trim())}`,
    );
    searchResults.value = data.results || [];
  } catch {
    searchResults.value = [];
  } finally {
    searchBusy.value = false;
  }
}

function goToSearchResult(r) {
  showSearchModal.value = false;
  selectFile(r.file);
  nextTick(() => aceRef.value?.gotoLine(r.line));
}

function downloadAsTemplate() {
  if (!currentProjectId.value) return;
  const url = `/api/projects/${currentProjectId.value}/download`;
  const a = document.createElement('a');
  a.href = url;
  a.download = (currentProjectName.value || 'template').replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '_') + '-template.zip';
  a.click();
}
function onToolbarInsert(text) {
  aceRef.value?.insertSnippet(text);
}
function downloadPdf() {
  if (pdfUrl.value) {
    const a = document.createElement('a');
    a.href = pdfUrl.value;
    a.download = currentFile.value.replace('.tex', '.pdf');
    a.click();
  }
}
function fullscreenPdf() {
  if (pdfUrl.value) window.open(pdfUrl.value, '_blank', 'width=1200,height=800');
}

function openContext(e, file) {
  e.preventDefault();
  ctxMenu.value = {
    show: true,
    x: Math.min(e.clientX, window.innerWidth - 200),
    y: Math.min(e.clientY, window.innerHeight - 160),
    file,
  };
}
function closeContext() {
  ctxMenu.value.show = false;
}
function ctxNewFile() {
  closeContext();
  newFilePath.value = 'new.tex';
  showNewFileModal.value = true;
}
function ctxRename() {
  closeContext();
  renameTarget.value = ctxMenu.value.file;
  renameValue.value = ctxMenu.value.file;
  showRenameModal.value = true;
}
function ctxDelete() {
  closeContext();
  deleteTarget.value = ctxMenu.value.file;
  showDeleteConfirm.value = true;
}
function ctxSetMain() {
  closeContext();
  setMainFile(ctxMenu.value.file);
}

async function doCreateFile() {
  try {
    await api(`/api/projects/${currentProjectId.value}/files`, {
      method: 'POST',
      body: JSON.stringify({ path: newFilePath.value, content: '' }),
    });
    showNewFileModal.value = false;
    success('Файл создан');
    await refreshFiles();
  } catch (e) {
    showError(e.message);
  }
}
async function doRename() {
  try {
    await api(`/api/projects/${currentProjectId.value}/files/${encodeURIComponent(renameTarget.value)}`, {
      method: 'PATCH',
      body: JSON.stringify({ new_path: renameValue.value }),
    });
    showRenameModal.value = false;
    success('Файл переименован');
    if (currentFile.value === renameTarget.value) currentFile.value = renameValue.value;
    await refreshFiles();
  } catch (e) {
    showError(e.message);
  }
}
async function doDelete() {
  try {
    await api(`/api/projects/${currentProjectId.value}/files/${encodeURIComponent(deleteTarget.value)}`, {
      method: 'DELETE',
    });
    showDeleteConfirm.value = false;
    success('Файл удалён');
    await refreshFiles();
    if (currentFile.value === deleteTarget.value && currentFiles.value.length) await selectFile(currentFiles.value[0]);
  } catch (e) {
    showError(e.message);
  }
}
async function doDeleteProject() {
  try {
    await api(`/api/projects/${currentProjectId.value}`, { method: 'DELETE' });
    showDeleteProjectConfirm.value = false;
    success('Проект удалён');
    currentProjectId.value = '';
    currentFiles.value = [];
    editorContent.value = '';
    showPreview.value = false;
    await loadProjects();
    router.replace({ name: 'editor' });
  } catch (e) {
    showError(e.message);
  }
}
async function doRenameProject() {
  await renameProject(renameProjectValue.value.trim());
  showRenameProjectModal.value = false;
}
function openRenameProject() {
  renameProjectValue.value = currentProjectName.value;
  showRenameProjectModal.value = true;
}

async function openCollaboratorsModal() {
  showCollaboratorsModal.value = true;
  collaborators.value = [];
  newCollaboratorId.value = '';
  newCollaboratorRole.value = 'write';
  if (!currentProjectId.value) return;
  collaboratorsLoading.value = true;
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/collaborators`);
    collaborators.value = data.collaborators || [];
  } catch (e) {
    showError(e.message);
  } finally {
    collaboratorsLoading.value = false;
  }
}

async function doAddCollaborator() {
  const id = (newCollaboratorId.value || '').trim();
  if (!id) {
    showError('Введите логин пользователя');
    return;
  }
  addCollaboratorBusy.value = true;
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/collaborators`, {
      method: 'POST',
      body: JSON.stringify({ user_id: id, role: newCollaboratorRole.value }),
    });
    collaborators.value = data.collaborators || [];
    newCollaboratorId.value = '';
    success('Соавтор добавлен');
  } catch (e) {
    showError(e.message);
  } finally {
    addCollaboratorBusy.value = false;
  }
}

async function doRemoveCollaborator(userId) {
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/collaborators/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    collaborators.value = data.collaborators || [];
    success('Соавтор удалён');
  } catch (e) {
    showError(e.message);
  }
}

function onPdfGoto({ file, line }) {
  if (file) selectFile(file);
  if (line != null && aceRef.value) aceRef.value.gotoLine(line);
}

async function fetchDefinitions() {
  if (!currentProjectId.value) return;
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/definitions`);
    definitionsCache.value = data.definitions || {};
  } catch {
    definitionsCache.value = {};
  }
}

async function onGotoDefinition(cmdName) {
  let defs = definitionsCache.value[cmdName];
  if (!defs || defs.length === 0) {
    await fetchDefinitions();
    defs = definitionsCache.value[cmdName];
  }
  if (!defs || defs.length === 0) return;
  const d = defs[0];
  if (d.file) await selectFile(d.file);
  await nextTick();
  if (d.line != null && aceRef.value) aceRef.value.gotoLine(d.line);
}

async function openNewProjectModal() {
  newProjName.value = 'Новый проект';
  showNewProjectModal.value = true;
  try {
    templates.value = (await api('/api/templates')).templates || [];
  } catch {
    templates.value = [];
  }
}
async function doCreateProject(templateId = null) {
  creatingProject.value = true;
  try {
    const body = { name: newProjName.value.trim() || 'Новый проект' };
    if (templateId) body.template_id = templateId;
    const p = await api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
    showNewProjectModal.value = false;
    success('Проект создан');
    await loadProjects();
    await selectProject(p.id, router);
  } catch (e) {
    showError(e.message);
  } finally {
    creatingProject.value = false;
  }
}
async function openHistory() {
  if (!currentProjectId.value || !currentFile.value) return;
  try {
    const data = await api(
      `/api/projects/${currentProjectId.value}/files/${encodeURIComponent(currentFile.value)}/history`,
    );
    historyVersions.value = data.versions || [];
    if (!historyVersions.value.length) {
      useToast().info('История пуста');
      return;
    }
    showHistoryModal.value = true;
  } catch (e) {
    showError(e.message);
  }
}
async function restoreVersion(vid) {
  try {
    const data = await api(
      `/api/projects/${currentProjectId.value}/files/${encodeURIComponent(currentFile.value)}/restore`,
      { method: 'POST', body: JSON.stringify({ version_id: vid }) },
    );
    editorContent.value = data.content || '';
    showHistoryModal.value = false;
    success('Версия восстановлена');
  } catch (e) {
    showError(e.message);
  }
}
async function handleLogout() {
  await logout();
  router.push('/');
}
function quickOpenSelect(file) {
  showQuickOpen.value = false;
  quickFilter.value = '';
  selectFile(file);
}
function gotoOutlineLine(line) {
  aceRef.value?.gotoLine(line);
}

async function doCreateFolder() {
  const p = newFolderPath.value.trim();
  if (!p) return;
  try {
    await api(`/api/projects/${currentProjectId.value}/folders`, { method: 'POST', body: JSON.stringify({ path: p }) });
    showNewFolderModal.value = false;
    success('Папка создана');
    await refreshFiles();
  } catch (e) {
    showError(e.message);
  }
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'eps', 'pdf', 'tif', 'tiff', 'bmp']);

function onDragEnter(e) {
  e.preventDefault();
  dragOver.value = true;
}
function onDragOver(e) {
  e.preventDefault();
}
function onDragLeave(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return;
  dragOver.value = false;
}
async function onDrop(e) {
  e.preventDefault();
  dragOver.value = false;
  if (!currentProjectId.value) return;
  const files = e.dataTransfer?.files;
  if (!files || !files.length) return;
  const form = new FormData();
  for (const f of files) form.append('files', f);
  try {
    const data = await api(`/api/projects/${currentProjectId.value}/upload`, { method: 'POST', body: form });
    await refreshFiles();
    const uploaded = data.uploaded || [];
    if (uploaded.length === 1) {
      const ext = uploaded[0].split('.').pop()?.toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        aceRef.value?.insertSnippet(`\\includegraphics[width=0.8\\textwidth]{${uploaded[0]}}`);
      }
    }
    success(`Загружено: ${uploaded.length} файл(ов)`);
  } catch (e) {
    showError(e.message);
  }
}

async function onCompilerChange(e) {
  await setCompiler(e.target.value);
}

function onLogLineClick(line) {
  const err = logErrors.value.find((e) => {
    if (e.message && line.includes(e.message)) return true;
    if (e.line == null) return false;
    return (
      line.includes('l.' + e.line) ||
      line.includes('line ' + e.line) ||
      line.includes('Line ' + e.line) ||
      new RegExp('\\b' + e.line + '\\b').test(line)
    );
  });
  if (!err) return;
  const targetFile = normPath(err.file) || normPath(mainFile.value);
  if (targetFile && targetFile !== normPath(currentFile.value)) selectFile(targetFile);
  if (err.line != null) {
    nextTick(() => aceRef.value?.gotoLine(err.line));
  }
}

// C5: Unsaved changes warning
onBeforeRouteLeave(() => {
  if (dirty.value) return window.confirm('Есть несохранённые изменения. Уйти?');
});
const beforeUnload = (e) => {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
};

// Resize
let resizing = false;
let resizeStart = 0;
let startLeft = 0;
let pendingRatio = null;
let resizeRafId = null;
const editorCol = ref(null);
const previewCol = ref(null);
const RATIO_KEY = 'leti_preview_ratio';

function applyResizeRatio(r) {
  if (editorCol.value) editorCol.value.style.flex = `${r * 100} 1 0%`;
  if (previewCol.value) previewCol.value.style.flex = `${(1 - r) * 100} 1 0%`;
}

function onResizeDown(e) {
  e.preventDefault();
  resizing = true;
  resizeStart = e.clientX;
  startLeft = editorCol.value?.offsetWidth || 0;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}
function onResizeMove(e) {
  if (!resizing) return;
  const total = editorCol.value?.parentElement?.offsetWidth || 1;
  pendingRatio = Math.max(0.15, Math.min(0.85, (startLeft + e.clientX - resizeStart) / total));
  if (resizeRafId == null) {
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      if (pendingRatio != null) {
        applyResizeRatio(pendingRatio);
        pendingRatio = null;
      }
    });
  }
}
function onResizeUp() {
  if (resizing) {
    resizing = false;
    if (resizeRafId != null) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    }
    const ratioToSave = pendingRatio ?? (() => {
      const total = editorCol.value?.parentElement?.offsetWidth;
      const w = editorCol.value?.offsetWidth;
      return total && w ? w / total : null;
    })();
    if (ratioToSave != null) localStorage.setItem(RATIO_KEY, String(ratioToSave));
    pendingRatio = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    if (logFullscreen.value) {
      logFullscreen.value = false;
      return;
    }
    closeContext();
    if (showQuickOpen.value) {
      showQuickOpen.value = false;
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    compile();
  }
  if (e.key === 'F5') {
    e.preventDefault();
    compile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    if (currentProjectId.value) {
      showQuickOpen.value = true;
      quickFilter.value = '';
    }
  }
  if (
    e.key === '?' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
    !document.querySelector('.ace_editor')?.contains(document.activeElement)
  )
    showShortcutsModal.value = true;
}

onMounted(() => {
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeUp);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', closeContext);
  window.addEventListener('beforeunload', beforeUnload);

  const saved = localStorage.getItem(RATIO_KEY);
  if (saved) {
    const r = parseFloat(saved);
    if (r > 0 && r < 1)
      nextTick(() => {
        if (editorCol.value) editorCol.value.style.flex = `${r * 100} 1 0%`;
        if (previewCol.value) previewCol.value.style.flex = `${(1 - r) * 100} 1 0%`;
      });
  }

  loadProjects().then(() => {
    const paramId = route.params.projectId;
    const lastId = paramId || localStorage.getItem('leti_last_project');
    if (lastId && projects.value.some((p) => p.id === lastId)) selectProject(lastId, router);
  });
  if (!localStorage.getItem(ONBOARDING_KEY)) showOnboardingHint.value = true;
});

function dismissOnboarding() {
  showOnboardingHint.value = false;
  localStorage.setItem(ONBOARDING_KEY, '1');
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeUp);
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', closeContext);
  window.removeEventListener('beforeunload', beforeUnload);
  cleanup();
});

function normPath(p) {
  return (p || '').replace(/^\.\//, '').replace(/\\/g, '/');
}
const errorLinesForCurrentFile = computed(() => {
  const cur = normPath(currentFile.value);
  const main = normPath(mainFile.value);
  return (logErrors.value || [])
    .filter((e) => {
      if (e.line == null || !cur) return false;
      const ef = normPath(e.file);
      return ef === cur || (!ef && cur === main);
    })
    .map((e) => e.line);
});

const errorAnnotationsForCurrentFile = computed(() => {
  const cur = normPath(currentFile.value);
  const main = normPath(mainFile.value);
  return (logErrors.value || [])
    .filter((e) => {
      if (e.line == null || !cur) return false;
      const ef = normPath(e.file);
      return ef === cur || (!ef && cur === main);
    })
    .map((e) => ({ line: e.line, message: e.message, severity: e.severity }));
});

const shortcuts = [
  ['Ctrl+S', 'Сохранить'],
  ['Ctrl+Enter', 'Компилировать'],
  ['F5', 'Компилировать'],
  ['Ctrl+P', 'Переключение файлов'],
  ['Escape', 'Закрыть'],
  ['?', 'Горячие клавиши'],
];
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <header class="app-header h-11 flex-shrink-0 flex items-center gap-1.5 px-3">
      <RouterLink to="/" class="flex items-center group mr-0.5"
        ><div
          class="w-6 h-6 rounded-md bg-gradient-to-br from-leti-gold to-leti-gold-dark flex items-center justify-center text-white font-bold text-[9px] shadow-[0_0_12px_rgba(187,141,84,0.12)] transition-transform group-hover:scale-105"
        >
          L
        </div></RouterLink
      >
      <RouterLink to="/" class="nav-link text-[11px] hidden md:inline-flex">Главная</RouterLink>
      <RouterLink to="/account" class="nav-link text-[11px] hidden md:inline-flex">Кабинет</RouterLink>
      <div class="h-4 w-px bg-white/[0.06] mx-1" />
      <select
        v-model="currentProjectId"
        class="select-base-sm min-w-[130px] w-auto"
        @change="selectProject(currentProjectId, router)"
      >
        <option value="">— Проект —</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <button
        class="btn-primary-sm"
        :disabled="compileBusy || !currentProjectId"
        @click="compile"
      >
        <svg v-if="!compileBusy" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 2l7 4-7 4V2z" />
        </svg>
        <span v-else class="spinner" style="width: 12px; height: 12px; border-width: 1.5px" />
        <span class="hidden sm:inline">{{ compileBusy ? 'Компиляция…' : 'Компилировать' }}</span>
      </button>
      <label class="flex items-center gap-1.5 text-[10px] text-white/35 cursor-pointer hover:text-white/55 transition-colors">
        <ToggleSwitch v-model="autoCompile" />
        <span class="hidden sm:inline">Авто</span>
      </label>
      <select
        v-if="autoCompile"
        v-model.number="autoCompileInterval"
        class="select-base-sm w-auto text-[10px] hidden sm:block"
        title="Интервал автокомпиляции"
        @change="localStorage.setItem('leti_auto_compile_interval', String(autoCompileInterval))"
      >
        <option :value="2">2 с</option>
        <option :value="5">5 с</option>
        <option :value="10">10 с</option>
      </select>
      <select
        v-if="currentProjectId"
        :value="compiler"
        class="select-base-sm w-auto text-[10px] hidden sm:block"
        @change="onCompilerChange"
      >
        <option value="pdflatex">pdfLaTeX</option>
        <option value="xelatex">XeLaTeX</option>
        <option value="lualatex">LuaLaTeX</option>
      </select>
      <div class="h-4 w-px bg-white/[0.06] mx-0.5 hidden sm:block" />
      <div class="hidden sm:flex items-center">
        <SegmentControl
          v-model="viewMode"
          :options="[
            { value: 'editor', icon: 'M1 1h8v8H1z' },
            { value: 'split', icon: 'M1 1h8v8H1zM5 1v8' },
            { value: 'preview', icon: 'M7 1H3v8h6V3l-2-2zM7 1v2h2' },
          ]"
        />
      </div>
      <button class="btn-ghost-sm text-leti-gold/50 hover:text-leti-gold" @click="openNewProjectModal">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v8M2 6h8" /></svg
        ><span class="hidden md:inline">Новый</span>
      </button>
      <button class="btn-ghost-sm text-white/35 hover:text-white/60" @click="openHistory">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 3v3l2 1.5m3-.5a5 5 0 11-10 0 5 5 0 0110 0z" /></svg
        ><span class="hidden md:inline">История</span>
      </button>
      <button
        class="btn-ghost-sm text-white/35 hover:text-white/60"
        title="Поиск по проекту"
        @click="showSearchModal = true; searchQuery = ''; searchResults = []"
      >
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="5" cy="5" r="3.5" />
          <path d="M8 8l2 2" />
        </svg>
      </button>
      <button class="btn-ghost-sm text-white/35 hover:text-white/60" @click="showShortcutsModal = true">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="10" height="7" rx="1" />
          <path d="M3 6h1M5 6h2M8 6h1M4 8h4" />
        </svg>
      </button>
      <span class="flex-1" />
      <span class="text-[10px] flex items-center gap-1.5 mr-1">
        <template v-if="dirty"
          ><span class="w-1.5 h-1.5 rounded-full bg-amber-400" /><span class="text-amber-400/70"
            >Не сохранено</span
          ></template
        >
        <template v-else-if="statusType === 'compiling'"
          ><span class="spinner" style="width: 10px; height: 10px; border-width: 1.5px" /><span
            class="text-leti-gold"
            >{{ statusMsg }}</span
          ></template
        >
        <template v-else-if="statusType === 'saved'"
          ><span class="w-1.5 h-1.5 rounded-full bg-green-400" /><span class="text-green-400/70">{{
            statusMsg
          }}</span></template
        >
        <template v-else-if="statusType === 'error'"
          ><span class="w-1.5 h-1.5 rounded-full bg-red-400" /><span class="text-red-400/70">{{
            statusMsg
          }}</span></template
        >
      </span>
      <span
        v-if="realtime.connected && realtime.otherUsers.length"
        class="text-[10px] text-leti-gold/70 ml-1.5"
        :title="'Совместное редактирование: ' + realtime.otherUsers.map((u) => u.username).join(', ')"
        >{{ realtime.otherUsers.map((u) => u.username).join(', ') }}</span
      >
      <span class="text-white/20 text-[10px] hidden md:inline font-mono">{{ cursorPos.line }}:{{ cursorPos.col }}</span>
      <span class="text-white/25 text-[10px] hidden md:inline ml-1.5">{{ displayName }}</span>
      <button class="btn-ghost-sm text-white/30 hover:text-white/50" @click="handleLogout">Выход</button>
    </header>

    <Transition name="slide-fade">
      <div
        v-if="showOnboardingHint"
        class="flex items-center justify-between gap-4 px-4 py-2 bg-leti-gold/10 border-b border-leti-gold/20 text-[11px] text-white/80"
      >
        <span class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Создайте проект из шаблона (кнопка «Новый»)</span>
          <span>Ctrl+Enter — компиляция</span>
          <span>Клик по ошибке в логе — переход в редактор</span>
        </span>
        <button class="btn-ghost-sm text-leti-gold hover:text-leti-gold/80 flex-shrink-0" @click="dismissOnboarding">
          Понятно
        </button>
      </div>
    </Transition>

    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <div
        class="flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border-r border-white/[0.06]"
        :class="sidebarCollapsed ? 'w-0' : 'w-48'"
      >
        <aside
          class="w-48 min-w-48 h-full bg-leti-blue/30 backdrop-blur-md flex flex-col overflow-hidden"
        >
        <div class="flex items-center justify-between px-3 py-1.5">
          <h3 class="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Проекты</h3>
          <button class="text-white/20 hover:text-white/50 transition-colors" @click="sidebarCollapsed = true">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 2L4 6l4 4" />
            </svg>
          </button>
        </div>
        <ul class="flex-1 overflow-auto px-1 min-h-0">
          <li
            v-for="p in projects"
            :key="p.id"
            :class="['sidebar-item', { active: p.id === currentProjectId }]"
            @click="selectProject(p.id, router)"
          >
            <span class="truncate">{{ p.name }}</span>
          </li>
        </ul>
        <button
          class="mx-2 mb-1.5 py-1 rounded-lg border border-dashed border-white/8 text-white/20 text-[10px] hover:border-leti-gold/30 hover:text-leti-gold/50 transition-all flex items-center justify-center gap-1"
          @click="openNewProjectModal"
        >
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 1v8M1 5h8" /></svg
          >Новый
        </button>
        <div class="divider" />
        <div class="flex items-center justify-between px-3 py-1.5">
          <h3 class="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Файлы</h3>
          <div v-if="currentProjectId" class="flex items-center gap-1">
            <button
              class="text-white/20 hover:text-leti-gold/60 transition-colors"
              title="Новая папка"
              @click="
                newFolderPath = '';
                showNewFolderModal = true;
              "
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 4l3-3h5l1 1h4l1 1v7H1V4z" />
              </svg>
            </button>
            <button
              class="text-white/20 hover:text-leti-gold/60 transition-colors"
              title="Новый файл"
              @click="
                newFilePath = 'new.tex';
                showNewFileModal = true;
              "
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 2v8M2 6h8" />
              </svg>
            </button>
          </div>
        </div>
        <ul class="flex-1 overflow-auto px-1 min-h-0">
          <li v-for="item in fileTreeItems" :key="item.path">
            <div
              v-if="item.type === 'folder'"
              class="sidebar-item cursor-pointer"
              :style="{ paddingLeft: 6 + item.depth * 10 + 'px' }"
              @click="toggleFolder(item.path)"
            >
              <svg
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="flex-shrink-0 text-leti-gold/40"
              >
                <path :d="folderIcon(item.expanded)" />
              </svg>
              <span class="truncate flex-1 text-white/50">{{ item.name }}</span>
            </div>
            <div
              v-else
              :class="['sidebar-item', { active: item.path === currentFile }]"
              :style="{ paddingLeft: 6 + item.depth * 10 + 'px' }"
              @click="selectFile(item.path)"
              @contextmenu="openContext($event, item.path)"
            >
              <svg
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                class="flex-shrink-0"
                :class="fileIcon(item.name)"
              >
                <path d="M8 1.5H3.5v9h7V4l-2.5-2.5z" />
                <path d="M8 1.5v2.5h2.5" />
              </svg>
              <span class="truncate flex-1">{{ item.name }}</span>
              <span
                v-if="item.path === mainFile"
                class="text-[8px] text-leti-gold/50 flex-shrink-0 ml-1"
                title="Главный файл"
                >main</span
              >
            </div>
          </li>
        </ul>
        <div
          v-if="currentProjectId && /\.tex$/i.test(currentFile)"
          class="border-t border-white/[0.06] flex flex-col min-h-0"
        >
          <div class="flex items-center justify-between px-3 py-1.5">
            <h3 class="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Оглавление</h3>
            <button
              class="text-white/20 hover:text-white/50 transition-colors"
              @click="outlineCollapsed = !outlineCollapsed"
            >
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                :class="outlineCollapsed ? '' : 'rotate-180'"
              >
                <path d="M4 8l4-4 4 4M4 8v4h8V8" />
              </svg>
            </button>
          </div>
          <ul v-show="!outlineCollapsed" class="overflow-auto px-2 pb-2 max-h-40 space-y-0.5 min-h-0">
            <li v-for="(entry, idx) in documentOutline" :key="idx" class="flex">
              <button
                type="button"
                class="text-left w-full py-0.5 px-1.5 rounded text-[11px] truncate hover:bg-white/[0.06] hover:text-leti-gold/70 text-white/50 transition-colors"
                :style="{ paddingLeft: 0.5 + entry.level * 0.5 + 'rem' }"
                :title="entry.title"
                @click="gotoOutlineLine(entry.line)"
              >
                {{ entry.title }}
              </button>
            </li>
            <li v-if="documentOutline.length === 0" class="text-[10px] text-white/20 py-1 px-1.5">Нет заголовков</li>
          </ul>
        </div>
        <div v-if="currentProjectId" class="px-2 pb-1.5 space-y-1">
          <button
            v-if="isProjectOwner"
            class="w-full py-1 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded transition-all"
            @click="openCollaboratorsModal"
          >
            Соавторы
          </button>
          <button
            class="w-full py-1 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded transition-all"
            @click="downloadAsTemplate"
          >
            Скачать как шаблон
          </button>
          <button
            class="w-full py-1 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.03] rounded transition-all"
            @click="openRenameProject"
          >
            Переименовать проект
          </button>
          <button
            class="w-full py-1 text-[10px] text-red-400/40 hover:text-red-400 hover:bg-red-400/5 rounded transition-all"
            @click="showDeleteProjectConfirm = true"
          >
            Удалить проект
          </button>
        </div>
        </aside>
      </div>
      <button
        v-if="sidebarCollapsed"
        class="w-8 flex-shrink-0 bg-leti-blue/20 border-r border-white/[0.06] flex items-center justify-center hover:bg-white/[0.03] transition-colors"
        @click="sidebarCollapsed = false"
      >
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" class="text-white/30">
          <path d="M4 2l4 4-4 4" />
        </svg>
      </button>

      <!-- Editor Column -->
      <div v-show="viewMode !== 'preview'" ref="editorCol" class="flex-1 flex flex-col min-w-0" style="flex: 1 1 0%">
        <div
          class="px-3 py-1 text-[11px] text-white/25 font-mono border-b border-white/[0.04] bg-leti-blue-dark/20 flex items-center gap-1.5"
        >
          <button
            v-if="currentProjectName"
            class="hover:text-leti-gold/60 transition-colors"
            @click="router.push('/account')"
          >
            {{ currentProjectName }}
          </button>
          <svg
            v-if="currentProjectName"
            width="8"
            height="8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            class="text-white/15"
          >
            <path d="M3 1l4 3-4 3" />
          </svg>
          <svg
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            :class="fileIcon(currentFile)"
          >
            <path d="M8 1.5H3.5v9h7V4l-2.5-2.5z" />
            <path d="M8 1.5v2.5h2.5" />
          </svg>
          <span class="text-white/40">{{ currentFile }}</span>
        </div>
        <LatexToolbar
          :custom-snippets="customSnippets"
          @insert="onToolbarInsert"
          @add-snippet="showAddSnippetModal = true"
        />
        <!-- B2: empty state when no project selected -->
        <div v-if="!currentProjectId" class="flex-1 flex flex-col items-center justify-center text-white/20 gap-3 p-8">
          <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" class="text-white/8">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p class="text-sm">Выберите проект слева или создайте новый</p>
          <button class="btn-primary-sm" @click="openNewProjectModal">Создать проект</button>
        </div>
        <div
          v-else
          class="flex-1 relative min-h-0"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <AceEditor
            ref="aceRef"
            :model-value="editorContent"
            :error-line-numbers="errorLinesForCurrentFile"
            :error-annotations="errorAnnotationsForCurrentFile"
            :bib-keys="bibKeys"
            @update:model-value="onEditorChange"
            @op="sendRealtimeOp"
            @save="saveCurrentFile"
            @compile="compile"
            @cursor-change="onCursorChange"
            @goto-definition="onGotoDefinition"
          />
          <Transition name="fade">
            <div
              v-if="dragOver"
              class="absolute inset-0 z-20 flex items-center justify-center bg-leti-blue/80 backdrop-blur-sm border-2 border-dashed border-leti-gold/50 rounded-lg pointer-events-none"
            >
              <div class="text-center">
                <svg
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="mx-auto mb-2 text-leti-gold/60"
                >
                  <path d="M20 6v18M12 18l8 8 8-8" />
                  <path d="M4 28v4h32v-4" />
                </svg>
                <p class="text-white/70 text-sm">Отпустите для загрузки</p>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div
        v-show="viewMode === 'split'"
        class="w-1 flex-shrink-0 bg-white/[0.04] cursor-col-resize hover:bg-leti-gold/25 active:bg-leti-gold/40 transition-colors group relative"
        @mousedown="onResizeDown"
      >
        <div class="absolute inset-y-0 -left-1 -right-1" />
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span class="w-0.5 h-0.5 rounded-full bg-white/30" /><span
            class="w-0.5 h-0.5 rounded-full bg-white/30"
          /><span class="w-0.5 h-0.5 rounded-full bg-white/30" />
        </div>
      </div>

      <!-- Preview -->
      <div
        v-show="viewMode !== 'editor'"
        ref="previewCol"
        class="flex flex-col min-w-[200px] bg-neutral-900/70 border-l border-white/[0.04]"
        style="flex: 1 1 0%"
      >
        <div class="flex items-center justify-between px-3 py-1 border-b border-white/[0.04] bg-leti-blue-dark/20">
          <span class="text-[10px] text-white/30 flex items-center gap-1.5"
            ><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" class="text-leti-gold/40">
              <path d="M7 1H3v8h6V3l-2-2z" /></svg
            >PDF</span
          >
          <div class="flex items-center gap-2">
            <button
              v-if="!logVisible"
              class="text-[9px] text-white/30 hover:text-white/60 transition-colors"
              title="Показать лог"
              @click="logVisible = true"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 4h10v6H2zM4 10v2M8 10v2M6 2v2" />
              </svg>
              Лог
            </button>
            <button
              v-if="showPreview"
              class="text-[9px] text-white/30 hover:text-white/60 transition-colors"
              @click="downloadPdf"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 8v2h6V8M6 2v6M4 6l2 2 2-2" />
              </svg>
            </button>
            <button
              class="text-[9px] text-leti-gold/40 hover:text-leti-gold transition-colors uppercase tracking-wider font-medium"
              @click="fullscreenPdf"
            >
              Полный экран
            </button>
          </div>
        </div>
        <PdfPreviewSync
          v-if="showPreview && currentProjectId"
          :pdf-url="pdfUrl"
          :project-id="currentProjectId"
          :sync-page="syncPdfPage"
          @goto="onPdfGoto"
        />
        <iframe v-else-if="showPreview" :src="pdfUrl" class="flex-1 w-full border-0 bg-neutral-800" title="PDF" />
        <div v-else class="flex-1 flex flex-col items-center justify-center text-white/12 text-sm gap-3 p-8">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1" class="text-white/6">
            <path d="M12 4H7a2 2 0 00-2 2v28a2 2 0 002 2h22a2 2 0 002-2V12L23 4H12z" />
            <path d="M23 4v8h8M14 20h8M14 25h5" />
          </svg>
          <span>Ctrl+Enter для компиляции</span>
        </div>
        <Transition name="slide-fade">
          <div v-if="logVisible" class="border-t border-white/[0.04] flex flex-col" style="max-height: 220px">
            <div
              class="flex items-center gap-2 px-3 py-1 text-[10px] text-white/30 border-b border-white/[0.04] bg-leti-blue-dark/20"
            >
              <span>Лог</span>
              <SegmentControl
                v-model="logFilter"
                class="ml-2"
                :options="[
                  { value: 'all', label: 'Все' },
                  { value: 'errors', label: 'Ошибки' },
                  { value: 'warnings', label: 'Warn' },
                ]"
                :option-active-class="(opt, active) =>
                  active && opt.value === 'errors'
                    ? '!bg-red-500/20 !text-red-400'
                    : active && opt.value === 'warnings'
                      ? '!bg-amber-500/20 !text-amber-400'
                      : ''"
              />
              <span class="flex-1" />
              <button class="text-[9px] text-white/20 hover:text-white/50" @click="logText = ''">Очистить</button>
              <button class="text-[9px] text-leti-gold/50 hover:text-leti-gold" @click="logFullscreen = true">
                Полный экран
              </button>
              <button class="text-[9px] text-white/20 hover:text-white/50" @click="logVisible = false">Скрыть</button>
            </div>
            <pre
              class="flex-1 overflow-auto p-2 text-[10px] font-mono text-white/35 bg-[#0a0e14] whitespace-pre-wrap leading-relaxed"
            ><template v-for="(line,i) in filteredLogLines" :key="i"><span :class="{'log-error':isLogError(line)}" @click="onLogLineClick(line)">{{ line }}
</span></template></pre>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Fullscreen Log -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="logFullscreen" class="fixed inset-0 z-[80] flex flex-col bg-[#0d1117]">
          <div class="flex items-center gap-2 px-4 py-2 border-b border-white/[0.08] bg-leti-blue-dark/40">
            <span class="text-sm text-white/50 font-medium">Лог компиляции</span>
            <SegmentControl
              v-model="logFilter"
              :options="[
                { value: 'all', label: 'Все' },
                { value: 'errors', label: 'Ошибки' },
                { value: 'warnings', label: 'Warn' },
              ]"
              :option-active-class="(opt, active) =>
                active && opt.value === 'errors'
                  ? '!bg-red-500/20 !text-red-400'
                  : active && opt.value === 'warnings'
                    ? '!bg-amber-500/20 !text-amber-400'
                    : ''"
            />
            <span class="flex-1" />
            <button class="text-xs text-white/30 hover:text-white/60" @click="logText = ''">Очистить</button>
            <button class="btn-primary-sm" @click="logFullscreen = false">Закрыть</button>
          </div>
          <pre
            class="flex-1 overflow-auto p-4 text-xs font-mono text-white/40 bg-[#0a0e14] whitespace-pre-wrap leading-relaxed"
          ><template v-for="(line,i) in filteredLogLines" :key="i"><span :class="{'log-error':isLogError(line)}" @click="onLogLineClick(line)">{{ line }}
</span></template></pre>
        </div>
      </Transition>
    </Teleport>

    <!-- Context Menu -->
    <Teleport to="body">
      <Transition name="scale">
        <div
          v-if="ctxMenu.show"
          class="ctx-menu fixed z-[70]"
          :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
          @click.stop
        >
          <button class="ctx-item" @click="ctxNewFile">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2v8M2 6h8" /></svg
            >Новый файл
          </button>
          <button class="ctx-item" @click="ctxRename">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 9l4-4 2 2-4 4H2V9z" /></svg
            >Переименовать
          </button>
          <button class="ctx-item" @click="ctxSetMain">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 1l1.5 3.5L11 5l-3 2.5L9 11l-3-2-3 2 1-3.5L1 5l3.5-.5z" /></svg
            >Сделать главным
          </button>
          <div class="divider my-1" />
          <button class="ctx-item danger" @click="ctxDelete">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 4h8M4 4V3h4v1M3 4l.5 6h5l.5-6" /></svg
            >Удалить
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Modals -->
    <ModalDialog :show="showQuickOpen" max-width="max-w-md" @close="showQuickOpen = false">
      <input
        v-model="quickFilter"
        class="input-base mb-3 !text-sm"
        placeholder="Поиск файла…"
        @keydown.enter="quickOpenFiles.length && quickOpenSelect(quickOpenFiles[0])"
        @keydown.escape="showQuickOpen = false"
      />
      <ul class="max-h-64 overflow-auto space-y-0.5">
        <li
          v-for="f in quickOpenFiles"
          :key="f"
          class="sidebar-item !rounded-lg hover:!bg-white/[0.06]"
          @click="quickOpenSelect(f)"
        >
          <svg
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            class="flex-shrink-0"
            :class="fileIcon(f)"
          >
            <path d="M8 1.5H3.5v9h7V4l-2.5-2.5z" />
            <path d="M8 1.5v2.5h2.5" /></svg
          >{{ f }}
        </li>
        <li v-if="!quickOpenFiles.length" class="text-center text-white/25 text-sm py-4">Нет результатов</li>
      </ul>
    </ModalDialog>

    <ModalDialog :show="showShortcutsModal" max-width="max-w-sm" @close="showShortcutsModal = false">
      <h3 class="text-lg font-semibold text-white mb-4">Горячие клавиши</h3>
      <div class="space-y-2">
        <div v-for="[key, desc] in shortcuts" :key="key" class="flex items-center justify-between py-1.5">
          <span class="text-sm text-white/60">{{ desc }}</span
          ><kbd
            class="text-[10px] font-mono bg-white/[0.06] border border-white/10 rounded px-2 py-0.5 text-white/50"
            >{{ key }}</kbd
          >
        </div>
      </div>
      <div class="flex justify-end mt-5">
        <button class="btn-secondary-sm" @click="showShortcutsModal = false">Закрыть</button>
      </div>
    </ModalDialog>

    <ModalDialog :show="showSearchModal" max-width="max-w-2xl" @close="showSearchModal = false">
      <h3 class="text-lg font-semibold text-white mb-3">Поиск по проекту</h3>
      <p class="text-xs text-white/40 mb-3">Поиск по содержимому .tex и .bib</p>
      <div class="flex gap-2 mb-4">
        <input
          v-model="searchQuery"
          class="input-base flex-1"
          placeholder="Введите фразу..."
          @keydown.enter="doSearch"
        />
        <button class="btn-primary-sm" :disabled="searchBusy || !searchQuery.trim()" @click="doSearch">
          {{ searchBusy ? '…' : 'Искать' }}
        </button>
      </div>
      <ul class="max-h-80 overflow-auto space-y-1 rounded border border-white/10 bg-white/[0.03] p-1">
        <li
          v-for="(r, idx) in searchResults"
          :key="idx"
          class="flex flex-col gap-0.5 px-2 py-1.5 rounded hover:bg-white/[0.08] cursor-pointer text-left"
          @click="goToSearchResult(r)"
        >
          <span class="text-[11px] font-mono text-leti-gold/80">{{ r.file }}:{{ r.line }}</span>
          <span class="text-xs text-white/70 truncate">{{ r.snippet }}</span>
        </li>
        <li v-if="searchResults.length === 0 && !searchBusy && searchQuery.trim()" class="text-xs text-white/30 py-4 text-center">
          Ничего не найдено
        </li>
        <li v-else-if="!searchQuery.trim()" class="text-xs text-white/25 py-4 text-center">Введите запрос и нажмите Искать</li>
      </ul>
      <div class="flex justify-end mt-3">
        <button class="btn-secondary-sm" @click="showSearchModal = false">Закрыть</button>
      </div>
    </ModalDialog>

    <ModalDialog :show="showAddSnippetModal" max-width="max-w-md" @close="showAddSnippetModal = false">
      <h3 class="text-lg font-semibold text-white mb-4">Добавить сниппет</h3>
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider"
        >Подпись (на кнопке)</label
      >
      <input v-model="snippetLabel" class="input-base mb-4" placeholder="Напр. eq" maxlength="4" />
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Текст вставки</label>
      <textarea
        v-model="snippetText"
        class="input-base mb-5 min-h-[80px]"
        placeholder="\\begin{equation}\n  \n\\end{equation}"
        rows="4"
      />
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showAddSnippetModal = false">Отмена</button>
        <button
          class="btn-primary-sm"
          :disabled="!snippetLabel.trim() || !snippetText.trim()"
          @click="
            addSnippet({ label: snippetLabel.trim(), title: snippetLabel.trim(), snippet: snippetText.trim() });
            snippetLabel = '';
            snippetText = '';
            showAddSnippetModal = false;
          "
        >
          Добавить
        </button>
      </div>
    </ModalDialog>
    <ModalDialog :show="showNewFolderModal" @close="showNewFolderModal = false"
      ><h3 class="text-lg font-semibold text-white mb-4">Новая папка</h3>
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Путь</label
      ><input v-model="newFolderPath" class="input-base mb-5" placeholder="sections" @keydown.enter="doCreateFolder" />
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showNewFolderModal = false">Отмена</button
        ><button class="btn-primary-sm" @click="doCreateFolder">Создать</button>
      </div></ModalDialog
    >
    <ModalDialog :show="showNewFileModal" @close="showNewFileModal = false"
      ><h3 class="text-lg font-semibold text-white mb-4">Новый файл</h3>
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Путь</label
      ><input
        v-model="newFilePath"
        class="input-base mb-5"
        placeholder="sections/intro.tex"
        @keydown.enter="doCreateFile"
      />
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showNewFileModal = false">Отмена</button
        ><button class="btn-primary-sm" @click="doCreateFile">Создать</button>
      </div></ModalDialog
    >
    <ModalDialog :show="showRenameModal" @close="showRenameModal = false"
      ><h3 class="text-lg font-semibold text-white mb-4">Переименовать</h3>
      <input v-model="renameValue" class="input-base mb-5" @keydown.enter="doRename" />
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showRenameModal = false">Отмена</button
        ><button class="btn-primary-sm" @click="doRename">Переименовать</button>
      </div></ModalDialog
    >
    <ModalDialog :show="showDeleteConfirm" @close="showDeleteConfirm = false"
      ><h3 class="text-lg font-semibold text-white mb-2">Удалить файл</h3>
      <p class="text-sm text-white/45 mb-6">Удалить «{{ deleteTarget }}»?</p>
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showDeleteConfirm = false">Отмена</button
        ><button class="btn-danger-sm !bg-red-600 hover:!bg-red-500 !shadow-none !text-white" @click="doDelete">
          Удалить
        </button>
      </div></ModalDialog
    >
    <ModalDialog :show="showDeleteProjectConfirm" @close="showDeleteProjectConfirm = false"
      ><h3 class="text-lg font-semibold text-white mb-2">Удалить проект</h3>
      <p class="text-sm text-white/45 mb-6">Удалить «{{ currentProjectName }}»? Это необратимо.</p>
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showDeleteProjectConfirm = false">Отмена</button
        ><button class="btn-danger-sm !bg-red-600 hover:!bg-red-500 !shadow-none !text-white" @click="doDeleteProject">
          Удалить
        </button>
      </div></ModalDialog
    >
    <ModalDialog :show="showRenameProjectModal" @close="showRenameProjectModal = false"
      ><h3 class="text-lg font-semibold text-white mb-4">Переименовать проект</h3>
      <input v-model="renameProjectValue" class="input-base mb-5" @keydown.enter="doRenameProject" />
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showRenameProjectModal = false">Отмена</button
        ><button class="btn-primary-sm" @click="doRenameProject">Переименовать</button>
      </div></ModalDialog
    >
    <ModalDialog :show="showCollaboratorsModal" max-width="max-w-md" @close="showCollaboratorsModal = false">
      <h3 class="text-lg font-semibold text-white mb-3">Соавторы</h3>
      <p class="text-xs text-white/40 mb-4">
        Пригласите пользователя по логину. Чтение — только просмотр; запись — редактирование и компиляция.
      </p>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newCollaboratorId"
          class="input-base flex-1 !py-1.5"
          placeholder="Логин пользователя"
          @keydown.enter="doAddCollaborator"
        />
        <select v-model="newCollaboratorRole" class="select-base-sm !w-24">
          <option value="read">Чтение</option>
          <option value="write">Запись</option>
        </select>
        <button class="btn-primary-sm" :disabled="addCollaboratorBusy" @click="doAddCollaborator">
          Добавить
        </button>
      </div>
      <div v-if="collaboratorsLoading" class="text-xs text-white/30 py-2">Загрузка…</div>
      <ul v-else class="space-y-1.5 max-h-48 overflow-auto mb-4">
        <li
          v-for="c in collaborators"
          :key="c.user_id"
          class="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.04]"
        >
          <span class="text-sm text-white/80">{{ c.display_name || c.user_id }}</span>
          <span class="text-[10px] text-white/35 uppercase mr-2">{{ c.role === 'write' ? 'запись' : 'чтение' }}</span>
          <button class="btn-ghost-sm text-red-400/70 hover:text-red-400" @click="doRemoveCollaborator(c.user_id)">
            Удалить
          </button>
        </li>
        <li v-if="collaborators.length === 0" class="text-xs text-white/25 py-2">Нет соавторов</li>
      </ul>
      <div class="flex justify-end">
        <button class="btn-secondary-sm" @click="showCollaboratorsModal = false">Закрыть</button>
      </div>
    </ModalDialog>
    <ModalDialog :show="showNewProjectModal" @close="showNewProjectModal = false"
      ><h3 class="text-lg font-semibold text-white mb-4">Новый проект</h3>
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Название</label
      ><input
        v-model="newProjName"
        class="input-base mb-5"
        placeholder="Введите название"
        @keydown.enter="doCreateProject(null)"
      />
      <div v-if="templates.length" class="mb-5">
        <label class="block text-[10px] font-semibold text-white/45 mb-2 uppercase tracking-wider">Шаблон</label>
        <div class="space-y-2 max-h-48 overflow-auto">
          <button
            v-for="t in templates"
            :key="t.id"
            class="card !p-3 text-left hover:!border-leti-gold/40 w-full"
            :disabled="creatingProject"
            @click="doCreateProject(t.id)"
          >
            <div class="font-medium text-white text-sm">{{ t.name }}</div>
            <div v-if="t.description" class="text-xs text-white/35 mt-0.5">{{ t.description }}</div>
          </button>
        </div>
      </div>
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showNewProjectModal = false">Отмена</button
        ><button class="btn-primary-sm" :disabled="creatingProject" @click="doCreateProject(null)">
          <span v-if="!creatingProject">Создать</span
          ><span v-else class="flex items-center gap-2"><span class="spinner" />Создание…</span>
        </button>
      </div></ModalDialog
    >
    <ModalDialog :show="showHistoryModal" @close="showHistoryModal = false"
      ><h3 class="text-lg font-semibold text-white mb-1">История версий</h3>
      <p class="text-xs text-white/35 mb-4 font-mono">{{ currentFile }}</p>
      <div class="space-y-1.5 max-h-80 overflow-auto pr-1">
        <div
          v-for="v in historyVersions"
          :key="v.id"
          class="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
        >
          <div class="min-w-0">
            <span class="text-sm text-white/60 font-mono">{{ v.timestamp || v.id }}</span>
            <p v-if="v.preview" class="text-xs text-white/25 mt-0.5 truncate">{{ v.preview }}</p>
          </div>
          <button
            class="btn-ghost-sm text-leti-gold hover:bg-leti-gold/10 flex-shrink-0"
            @click="restoreVersion(v.id)"
          >
            Восстановить
          </button>
        </div>
      </div>
      <div class="flex justify-end mt-5">
        <button class="btn-secondary-sm" @click="showHistoryModal = false">Закрыть</button>
      </div></ModalDialog
    >
  </div>
</template>
