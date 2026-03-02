import { ref, computed } from 'vue';
import { api } from './useApi.js';
import { useToast } from './useToast.js';

const projects = ref([]);
const currentProjectId = ref('');
const currentProjectData = ref(null);
const currentFiles = ref([]);
const currentFile = ref('main.tex');
const mainFile = ref('main.tex');
const compiler = ref('pdflatex');
const editorContent = ref('');
let fileLoaded = false;

const cursorPos = ref({ line: 1, col: 1 });
const dirty = ref(false);
const compileBusy = ref(false);
const autoCompile = ref(false);
const statusMsg = ref('');
const statusType = ref('');

const showPreview = ref(false);
const pdfUrl = ref('');
const logText = ref('');
const logErrors = ref([]);
const logVisible = ref(false);
const logFilter = ref('all');

let saveTimer = null;
const SAVE_DEBOUNCE = 2000;

export function useEditor() {
  const { success, error: showError, info: _info, warning } = useToast();

  const currentProjectName = computed(() => {
    const p = projects.value.find((x) => x.id === currentProjectId.value);
    return p?.name || '';
  });

  const filteredLogLines = computed(() => {
    if (!logText.value) return [];
    const lines = logText.value.split('\n');
    if (logFilter.value === 'all') return lines;
    return lines.filter((l) => {
      const isErr = logErrors.value.some(
        (e) => (e.message && l.includes(e.message)) || (e.line != null && l.includes('l.' + e.line)),
      );
      const isWarn = l.toLowerCase().includes('warning');
      if (logFilter.value === 'errors') return isErr || l.startsWith('!');
      if (logFilter.value === 'warnings') return isWarn;
      return true;
    });
  });

  function setStatus(msg, type = '') {
    statusMsg.value = msg;
    statusType.value = type;
    if (type === 'saved')
      setTimeout(() => {
        if (statusMsg.value === msg) {
          statusMsg.value = '';
          statusType.value = '';
        }
      }, 2500);
  }

  function fileIcon(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons = {
      tex: 'text-leti-gold/60',
      bib: 'text-green-400/60',
      sty: 'text-blue-400/60',
      cls: 'text-purple-400/60',
      csv: 'text-orange-400/60',
      md: 'text-white/40',
      txt: 'text-white/30',
    };
    return icons[ext] || 'text-white/25';
  }

  function isLogError(line) {
    return logErrors.value.some(
      (e) => (e.message && line.includes(e.message)) || (e.line != null && line.includes('l.' + e.line)),
    );
  }

  async function loadProjects() {
    try {
      const data = await api('/api/projects');
      projects.value = data.projects || [];
    } catch (e) {
      showError(e.message);
    }
  }

  async function selectProject(id, router) {
    clearTimeout(saveTimer);
    if (fileLoaded && currentProjectId.value) await saveCurrentFile();
    fileLoaded = false;
    dirty.value = false;
    currentProjectId.value = id;
    showPreview.value = false;
    pdfUrl.value = '';
    logVisible.value = false;
    logText.value = '';
    if (router) router.replace({ name: 'editor', params: { projectId: id } });
    try {
      const proj = await api(`/api/projects/${id}`);
      currentProjectData.value = proj;
      currentFiles.value = proj.files || [];
      mainFile.value = proj.main_file || 'main.tex';
      compiler.value = proj.compiler || 'pdflatex';
      const first = currentFiles.value.includes(mainFile.value) ? mainFile.value : currentFiles.value[0];
      if (first) await selectFile(first);
    } catch (e) {
      showError(e.message);
    }
  }

  async function selectFile(file) {
    clearTimeout(saveTimer);
    if (fileLoaded && currentProjectId.value) await saveCurrentFile();
    fileLoaded = false;
    dirty.value = false;
    currentFile.value = file;
    localStorage.setItem('leti_last_file', file);
    try {
      const data = await api(`/api/projects/${currentProjectId.value}/files/${encodeURIComponent(file)}`);
      editorContent.value = data.content || '';
      fileLoaded = true;
    } catch (e) {
      showError(e.message);
    }
  }

  async function saveCurrentFile() {
    if (!currentProjectId.value || !fileLoaded) return;
    try {
      await api(`/api/projects/${currentProjectId.value}/files/${encodeURIComponent(currentFile.value)}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editorContent.value }),
      });
      dirty.value = false;
      setStatus('Сохранено', 'saved');
      if (autoCompile.value) compile();
    } catch {
      setStatus('Ошибка сохранения', 'error');
    }
  }

  function onEditorChange(val) {
    editorContent.value = val;
    dirty.value = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (currentProjectId.value && fileLoaded) saveCurrentFile();
    }, SAVE_DEBOUNCE);
  }

  async function compile() {
    if (!currentProjectId.value) {
      warning('Выберите проект');
      return;
    }
    if (dirty.value) await saveCurrentFile();
    compileBusy.value = true;
    setStatus('Компиляция…', 'compiling');
    logVisible.value = true;
    logText.value = 'Запуск компиляции…';
    logErrors.value = [];
    try {
      const data = await api(`/api/projects/${currentProjectId.value}/compile`, { method: 'POST' });
      logText.value = data.log || '';
      logErrors.value = data.errors || [];
      if (data.success && data.pdf_url) {
        showPreview.value = true;
        pdfUrl.value = data.pdf_url + '?t=' + Date.now();
        setStatus(data.hasWarnings ? 'Готово (с предупреждениями)' : 'Готово', 'saved');
        success('Компиляция успешна');
      } else {
        setStatus('Ошибка компиляции', 'error');
        showError(`Ошибки: ${logErrors.value.length}`);
      }
    } catch (e) {
      setStatus(e.message, 'error');
      logText.value = e.message;
      showError(e.message);
    } finally {
      compileBusy.value = false;
    }
  }

  async function refreshFiles() {
    if (!currentProjectId.value) return;
    try {
      const proj = await api(`/api/projects/${currentProjectId.value}`);
      currentFiles.value = proj.files || [];
      mainFile.value = proj.main_file || 'main.tex';
      compiler.value = proj.compiler || 'pdflatex';
    } catch {
      /* ignore refresh error */
    }
  }

  async function setMainFile(file) {
    try {
      await api(`/api/projects/${currentProjectId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ main_file: file }),
      });
      mainFile.value = file;
      success(`Главный файл: ${file}`);
    } catch (e) {
      showError(e.message);
    }
  }

  async function setCompiler(newCompiler) {
    try {
      await api(`/api/projects/${currentProjectId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ compiler: newCompiler }),
      });
      compiler.value = newCompiler;
      success(`Компилятор: ${newCompiler}`);
    } catch (e) {
      showError(e.message);
    }
  }

  async function renameProject(newName) {
    try {
      await api(`/api/projects/${currentProjectId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      });
      await loadProjects();
      success('Проект переименован');
    } catch (e) {
      showError(e.message);
    }
  }

  function cleanup() {
    clearTimeout(saveTimer);
  }

  return {
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
    setStatus,
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
    get fileLoaded() {
      return fileLoaded;
    },
  };
}
