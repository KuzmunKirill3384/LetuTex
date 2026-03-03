<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { LATEX_COMMANDS, LATEX_ENVIRONMENTS } from '@/composables/latexCompletions.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  errorLineNumbers: { type: Array, default: () => [] },
  errorAnnotations: { type: Array, default: () => [] },
  bibKeys: { type: Array, default: () => [] },
  spellcheck: { type: Boolean, default: true },
  spellcheckLang: { type: String, default: 'ru' },
});
const emit = defineEmits(['update:modelValue', 'save', 'compile', 'cursorChange', 'gotoDefinition', 'op']);

const wrapper = ref(null);
const loadError = ref(false);
let editor = null;
let ignoreChange = false;
let ready = false;
let pendingContent = null;
let errorMarkers = [];

function setContent(val) {
  if (!editor || !ready) {
    pendingContent = val;
    return;
  }
  const current = editor.getValue();
  if (val === current) return;
  ignoreChange = true;
  const cursor = editor.getCursorPosition();
  editor.setValue(val || '', 1);
  editor.clearSelection();
  editor.moveCursorToPosition(cursor);
  ignoreChange = false;
  requestAnimationFrame(() => {
    editor?.renderer?.scrollCursorIntoView?.(cursor);
    editor?.resize();
  });
}

function insertSnippet(text) {
  if (!editor) return;
  editor.insert(text);
  editor.focus();
}

function setupLatexCompleter(ace) {
  const langTools = ace.require('ace/ext/language_tools');
  if (!langTools) return;

  langTools.addCompleter({
    getCompletions(_editor, session, pos, _prefix, callback) {
      const line = session.getLine(pos.row);
      const before = line.slice(0, pos.column);

      const citeMatch = before.match(/\\(?:cite|citep|citet|nocite)\s*\{([^}]*)$/);
      if (citeMatch && Array.isArray(props.bibKeys) && props.bibKeys.length) {
        const typed = citeMatch[1].toLowerCase();
        const suggestions = props.bibKeys
          .filter((k) => k.toLowerCase().startsWith(typed))
          .map((k) => ({ caption: k, value: k, meta: 'bib', score: 180 }));
        if (suggestions.length) return callback(null, suggestions);
      }

      const envMatch = before.match(/\\(?:begin|end)\{([a-zA-Z*]*)$/);
      if (envMatch) {
        const typed = envMatch[1].toLowerCase();
        return callback(
          null,
          LATEX_ENVIRONMENTS.filter((e) => e.name.toLowerCase().startsWith(typed)).map((e) => ({
            caption: e.name,
            value: e.name,
            meta: 'env',
            score: 200,
          })),
        );
      }

      const cmdMatch = before.match(/\\([a-zA-Z]*)$/);
      if (cmdMatch) {
        const typed = cmdMatch[1].toLowerCase();
        return callback(
          null,
          LATEX_COMMANDS.filter((c) => c.name.toLowerCase().startsWith(typed)).map((c) => ({
            caption: '\\' + c.name,
            value: c.snippet || c.name,
            meta: c.meta || 'cmd',
            score: 150,
          })),
        );
      }

      callback(null, []);
    },
  });
}

function setupLatexFolding(ace) {
  const Range = ace.require('ace/range').Range;
  if (!Range || !editor) return;

  const session = editor.session;
  session.setFoldStyle('markbeginend');

  const origGetFoldWidget = session.getFoldWidget?.bind(session);
  session.getFoldWidget = function (row) {
    const line = this.getLine(row);
    if (/\\begin\{/.test(line)) return 'start';
    if (/\\(part|chapter|section|subsection|subsubsection)\s*\*?\s*[\[{]/.test(line)) return 'start'; // eslint-disable-line no-useless-escape
    return origGetFoldWidget ? origGetFoldWidget(row) : '';
  };

  session.getFoldWidgetRange = function (row) {
    const line = this.getLine(row);
    const beginMatch = line.match(/\\begin\{(\w+\*?)\}/);
    if (beginMatch) {
      const env = beginMatch[1];
      const startRe = new RegExp('\\\\begin\\{' + env.replace('*', '\\*') + '\\}');
      const endRe = new RegExp('\\\\end\\{' + env.replace('*', '\\*') + '\\}');
      let depth = 1;
      for (let i = row + 1; i < this.getLength(); i++) {
        const l = this.getLine(i);
        if (startRe.test(l)) depth++;
        if (endRe.test(l)) {
          depth--;
          if (depth === 0) return new Range(row, line.length, i, 0);
        }
      }
      return null;
    }

    const secMatch = line.match(/\\(part|chapter|section|subsection|subsubsection)/);
    if (secMatch) {
      const levels = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4 };
      const myLevel = levels[secMatch[1]];
      for (let i = row + 1; i < this.getLength(); i++) {
        const l = this.getLine(i);
        const m = l.match(/\\(part|chapter|section|subsection|subsubsection)/);
        if (m && levels[m[1]] <= myLevel) return new Range(row, line.length, i - 1, this.getLine(i - 1).length);
        if (/\\end\{document\}/.test(l)) return new Range(row, line.length, i - 1, this.getLine(i - 1).length);
      }
      return new Range(row, line.length, this.getLength() - 1, this.getLine(this.getLength() - 1).length);
    }

    return null;
  };
}

onMounted(async () => {
  const ace = await loadAce();
  if (!ace || !wrapper.value) {
    loadError.value = !ace;
    return;
  }
  editor = ace.edit(wrapper.value);
  editor.setTheme('ace/theme/chrome');
  editor.session.setMode('ace/mode/latex');
  editor.session.setUseWrapMode(true);
  editor.setFontSize(14);
  editor.setOptions({
    fontFamily: "'JetBrains Mono', monospace",
    showPrintMargin: false,
    highlightActiveLine: true,
    highlightGutterLine: true,
    cursorStyle: 'smooth',
    animatedScroll: true,
    tabSize: 2,
    useSoftTabs: true,
    enableAutoIndent: true,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    enableSnippets: false,
    showFoldWidgets: true,
  });
  editor.renderer.setScrollMargin(4, 4);
  if (wrapper.value) {
    wrapper.value.setAttribute('spellcheck', props.spellcheck ? 'true' : 'false');
    wrapper.value.setAttribute('lang', props.spellcheckLang || 'ru');
  }

  setupLatexCompleter(ace);
  setupLatexFolding(ace);

  editor.on('change', (e) => {
    if (!ignoreChange) {
      emit('update:modelValue', editor.getValue());
      const data = e.data;
      if (data && (data.action === 'insert' || data.action === 'remove')) {
        const doc = editor.session.getDocument();
        if (doc.positionToIndex) {
          const pos = doc.positionToIndex(data.range.start);
          if (data.action === 'insert') {
            emit('op', { type: 'insert', pos, text: data.text || '' });
          } else {
            const len = doc.positionToIndex(data.range.end) - pos;
            emit('op', { type: 'delete', pos, len });
          }
        }
      }
    }
  });

  editor.selection.on('changeCursor', () => {
    const pos = editor.getCursorPosition();
    emit('cursorChange', { line: pos.row + 1, col: pos.column + 1 });
  });

  editor.on('click', (e) => {
    if (!(e.domEvent.ctrlKey || e.domEvent.metaKey)) return;
    const pos = editor.getCursorPosition();
    const session = editor.session;
    const line = session.getLine(pos.row) || '';
    let start = pos.column;
    while (start > 0 && /[a-zA-Z@*]/.test(line[start - 1])) start--;
    if (start > 0 && line[start - 1] === '\\') start--;
    let end = pos.column;
    while (end < line.length && /[a-zA-Z@*]/.test(line[end])) end++;
    const word = line.slice(start, end);
    if (word && (word.startsWith('\\') || (start > 0 && line[start - 1] === '\\'))) {
      const cmd = word.startsWith('\\') ? word : '\\' + word;
      e.domEvent.preventDefault();
      emit('gotoDefinition', cmd);
    }
  });

  editor.commands.addCommand({
    name: 'save',
    bindKey: { win: 'Ctrl-S', mac: 'Cmd-S' },
    exec: () => emit('save'),
  });
  editor.commands.addCommand({
    name: 'compile',
    bindKey: { win: 'Ctrl-Enter', mac: 'Cmd-Enter' },
    exec: () => emit('compile'),
  });

  ready = true;
  await nextTick();
  editor.resize();

  if (pendingContent !== null) {
    setContent(pendingContent);
    pendingContent = null;
  } else if (props.modelValue) {
    setContent(props.modelValue);
  }
  nextTick(() => updateErrorMarkers());
});

watch(
  () => props.modelValue,
  (val) => {
    if (!ready) {
      pendingContent = val;
      return;
    }
    if (editor && val !== editor.getValue()) setContent(val);
  },
);

function updateErrorMarkers() {
  if (!editor || !window.ace) return;
  const Range = window.ace.require('ace/range').Range;
  const session = editor.session;
  errorMarkers.forEach((id) => {
    try {
      session.removeMarker(id);
    } catch {
      /* ignore */
    }
  });
  errorMarkers = [];
  const anns = Array.isArray(props.errorAnnotations) ? props.errorAnnotations : [];
  const lines = Array.isArray(props.errorLineNumbers) ? props.errorLineNumbers : [];
  const seen = new Set();
  for (const a of anns) {
    if (a.line == null) continue;
    const row = Math.max(0, parseInt(a.line, 10) - 1);
    if (row >= session.getLength() || seen.has(row)) continue;
    seen.add(row);
    const lineLen = session.getLine(row)?.length ?? 0;
    const range = new Range(row, 0, row, lineLen);
    const cls = a.severity === 'warning' ? 'ace_warning_line' : 'ace_error_line';
    const id = session.addMarker(range, cls, 'fullLine', false);
    errorMarkers.push(id);
  }
  for (const lineNum of lines) {
    const row = Math.max(0, parseInt(lineNum, 10) - 1);
    if (row >= session.getLength() || seen.has(row)) continue;
    seen.add(row);
    const lineLen = session.getLine(row)?.length ?? 0;
    const range = new Range(row, 0, row, lineLen);
    const id = session.addMarker(range, 'ace_error_line', 'fullLine', false);
    errorMarkers.push(id);
  }
  const annotations = anns
    .filter((a) => a.line != null)
    .map((a) => ({
      row: Math.max(0, parseInt(a.line, 10) - 1),
      column: 0,
      text: (a.message || '').slice(0, 120),
      type: a.severity === 'warning' ? 'warning' : 'error',
    }))
    .filter((a) => a.row < session.getLength());
  session.setAnnotations(annotations);
}

watch(
  () => [props.errorLineNumbers, props.errorAnnotations],
  () => updateErrorMarkers(),
  { deep: true },
);

watch(
  () => [props.spellcheck, props.spellcheckLang],
  () => {
    if (wrapper.value) {
      wrapper.value.setAttribute('spellcheck', props.spellcheck ? 'true' : 'false');
      wrapper.value.setAttribute('lang', props.spellcheckLang || 'ru');
    }
  },
);

onBeforeUnmount(() => {
  ready = false;
  editor?.destroy();
  editor = null;
});

function loadAce() {
  return Promise.resolve(window.ace || null);
}

function gotoLine(line) {
  if (!editor) return;
  editor.gotoLine(line, 0, true);
  editor.focus();
}

function focus() {
  editor?.focus();
}

defineExpose({ gotoLine, insertSnippet, focus });
</script>

<template>
  <div class="ace-editor-root absolute inset-0">
    <style>
      .ace_error_line {
        background: rgba(239, 68, 68, 0.22) !important;
        border-left: 3px solid rgba(239, 68, 68, 0.8) !important;
      }
      .ace_warning_line {
        background: rgba(245, 158, 11, 0.12) !important;
        border-left: 3px solid rgba(245, 158, 11, 0.6) !important;
      }
    </style>
    <div v-if="loadError" class="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
      <div class="text-center">
        <svg
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="mx-auto mb-3 text-red-400/40"
        >
          <circle cx="16" cy="16" r="12" />
          <path d="M12 12l8 8M20 12l-8 8" />
        </svg>
        <p>Не удалось загрузить редактор</p>
        <button class="btn-ghost text-xs text-leti-gold mt-2" @click="location.reload()">Обновить страницу</button>
      </div>
    </div>
    <div v-else ref="wrapper" style="position: absolute; inset: 0" />
  </div>
</template>
