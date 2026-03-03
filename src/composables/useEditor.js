import { ref, computed } from 'vue';
import { api } from './useApi.js';
import { useToast } from './useToast.js';
import { applyOpToContent } from './useRealtime.js';
import { useAuth } from './useAuth.js';

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
const AUTO_INTERVAL_KEY = 'leti_auto_compile_interval';
const autoCompileInterval = ref(Math.max(2, Math.min(10, parseInt(localStorage.getItem(AUTO_INTERVAL_KEY) || '5', 10)) || 5));
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

export function useEditor(realtime) {
  const { success, error: showError, info: _info, warning } = useToast();
  const { user } = useAuth();

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
    return logErrors.value.some((e) => {
      if (e.message && line.includes(e.message)) return true;
      if (e.line == null) return false;
      return (
        line.includes('l.' + e.line) ||
        line.includes('line ' + e.line) ||
        line.includes('Line ' + e.line) ||
        new RegExp('\\b' + e.line + '\\b').test(line)
      );
    });
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
    realtime?.disconnect?.();
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
    const projectId = currentProjectId.value;
    try {
      const data = await api(`/api/projects/${projectId}/files/${encodeURIComponent(file)}`);
      editorContent.value = data.content ?? '';
      fileLoaded = true;
    } catch (e) {
      showError(e.message);
    }
    if (realtime?.connect) {
      try {
        await realtime.connect(projectId, file, {
          onDoc(content) {
            if (content != null) editorContent.value = content;
          },
          onOp(op, remoteUserId) {
            if (remoteUserId && user.value?.id === remoteUserId) return;
            editorContent.value = applyOpToContent(editorContent.value, op);
          },
        });
      } catch {
        realtime.disconnect?.();
      }
    }
  }

  function sendRealtimeOp(op) {
    realtime?.sendOp?.(op);
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
    const delay = autoCompile.value ? autoCompileInterval.value * 1000 : SAVE_DEBOUNCE;
    saveTimer = setTimeout(() => {
      if (currentProjectId.value && fileLoaded) saveCurrentFile();
    }, delay);
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
    sendRealtimeOp,
    get fileLoaded() {
      return fileLoaded;
    },
  };
}
