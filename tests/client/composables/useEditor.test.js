import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('@/composables/useApi.js', () => ({ api: vi.fn() }));
vi.mock('@/composables/useAuth.js', () => ({ useAuth: () => ({ user: ref({ id: 'u1' }) }) }));
vi.mock('@/composables/useToast.js', () => ({
  useToast: () => ({ success: () => {}, error: () => {}, info: () => {}, warning: () => {} }),
}));

const { api } = await import('@/composables/useApi.js');

describe('useEditor (file display)', () => {
  let editor;
  let editorContent;
  let currentProjectId;
  let selectFile;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    editorContent = editor.editorContent;
    currentProjectId = editor.currentProjectId;
    selectFile = editor.selectFile;
    cleanup = editor.cleanup;
    currentProjectId.value = 'proj1';
    editorContent.value = '';
  });

  afterEach(() => {
    cleanup?.();
  });

  it('updates editorContent when switching to another file (API response)', async () => {
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'PUT') return Promise.resolve({});
      if (path.includes('main.tex')) return Promise.resolve({ content: 'content of main.tex' });
      if (path.includes('other.tex')) return Promise.resolve({ content: 'content of other.tex' });
      return Promise.resolve({ content: '' });
    });
    await selectFile('main.tex');
    expect(editorContent.value).toBe('content of main.tex');

    await selectFile('other.tex');
    expect(editorContent.value).toBe('content of other.tex');
  });

  it('uses empty string when API returns no content', async () => {
    api.mockResolvedValueOnce({});
    await selectFile('empty.tex');
    expect(editorContent.value).toBe('');
  });

  it('still sets content from API when realtime connect does not call onDoc', async () => {
    const realtime = { connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() };
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'PUT') return Promise.resolve({});
      return Promise.resolve({ content: 'from-api' });
    });
    const mod = await import('@/composables/useEditor.js');
    const ed = mod.useEditor(realtime);
    currentProjectId = ed.currentProjectId;
    currentProjectId.value = 'proj1';
    ed.editorContent.value = 'old';
    await ed.selectFile('main.tex');
    expect(ed.editorContent.value).toBe('from-api');
  });
});

describe('useEditor (selectProject)', () => {
  let editor;
  let selectProject;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    selectProject = editor.selectProject;
    cleanup = editor.cleanup;
  });

  afterEach(() => cleanup?.());

  it('loads project and first file: currentFiles, mainFile, editorContent updated', async () => {
    api.mockImplementation((path) => {
      if (path.endsWith('/proj1')) return Promise.resolve({ files: ['main.tex', 'a.tex'], main_file: 'main.tex', compiler: 'pdflatex' });
      if (path.includes('/files/main.tex')) return Promise.resolve({ content: 'first file content' });
      return Promise.resolve({});
    });
    await selectProject('proj1', null);
    expect(editor.currentFiles.value).toEqual(['main.tex', 'a.tex']);
    expect(editor.mainFile.value).toBe('main.tex');
    expect(editor.currentFile.value).toBe('main.tex');
    expect(editor.editorContent.value).toBe('first file content');
  });

  it('clears preview and log when switching project', async () => {
    editor.currentProjectId.value = 'old';
    editor.showPreview.value = true;
    editor.pdfUrl.value = '/old/output.pdf';
    editor.logText.value = 'old log';
    api.mockImplementation((path) => {
      if (path.endsWith('/proj2')) return Promise.resolve({ files: ['main.tex'], main_file: 'main.tex' });
      if (path.includes('/files/main.tex')) return Promise.resolve({ content: 'c' });
      return Promise.resolve({});
    });
    await selectProject('proj2', null);
    expect(editor.showPreview.value).toBe(false);
    expect(editor.pdfUrl.value).toBe('');
    expect(editor.logText.value).toBe('');
  });
});

describe('useEditor (compile)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
    editor.currentProjectId.value = 'p1';
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'PUT') return Promise.resolve({});
      if (opts?.method === 'POST' && path.endsWith('/compile')) return Promise.resolve({ success: true, pdf_url: '/p1/output.pdf', log: 'Compiled.', errors: [] });
      return Promise.resolve({ content: 'x' });
    });
    await editor.selectFile('main.tex');
  });

  afterEach(() => cleanup?.());

  it('on success updates pdfUrl, logText, logErrors, showPreview', async () => {
    await editor.compile();
    expect(editor.pdfUrl.value).toContain('/p1/output.pdf');
    expect(editor.logText.value).toBe('Compiled.');
    expect(editor.logErrors.value).toEqual([]);
    expect(editor.showPreview.value).toBe(true);
  });

  it('on compile failure updates logText and logErrors, no pdfUrl', async () => {
    editor.pdfUrl.value = '';
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'POST' && path.endsWith('/compile')) return Promise.resolve({ success: false, log: 'Error log', errors: [{ line: 5, message: 'x' }] });
      if (opts?.method === 'PUT') return Promise.resolve({});
      return Promise.resolve({ content: 'x' });
    });
    await editor.compile();
    expect(editor.logText.value).toBe('Error log');
    expect(editor.logErrors.value).toHaveLength(1);
    expect(editor.logErrors.value[0].line).toBe(5);
    expect(editor.pdfUrl.value).toBe('');
  });
});

describe('useEditor (refreshFiles)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
    editor.currentProjectId.value = 'p1';
    editor.currentFiles.value = ['main.tex'];
  });

  afterEach(() => cleanup?.());

  it('updates currentFiles and mainFile from API', async () => {
    api.mockResolvedValue({ files: ['main.tex', 'new.tex'], main_file: 'new.tex', compiler: 'xelatex' });
    await editor.refreshFiles();
    expect(editor.currentFiles.value).toEqual(['main.tex', 'new.tex']);
    expect(editor.mainFile.value).toBe('new.tex');
  });
});

describe('useEditor (onEditorChange)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
    editor.currentProjectId.value = 'p1';
    await editor.selectFile('main.tex');
  });

  afterEach(() => cleanup?.());

  it('updates editorContent and sets dirty', () => {
    editor.onEditorChange('new text');
    expect(editor.editorContent.value).toBe('new text');
    expect(editor.dirty.value).toBe(true);
  });
});

describe('useEditor (saveCurrentFile)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
    editor.currentProjectId.value = 'p1';
    editor.editorContent.value = 'saved content';
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'PUT') return Promise.resolve({});
      return Promise.resolve({ content: 'saved content' });
    });
    await editor.selectFile('main.tex');
    editor.dirty.value = true;
  });

  afterEach(() => cleanup?.());

  it('sends PUT with content and clears dirty', async () => {
    await editor.saveCurrentFile();
    expect(api).toHaveBeenCalledWith(expect.stringContaining('main.tex'), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ content: 'saved content' }) }));
    expect(editor.dirty.value).toBe(false);
  });
});

describe('useEditor (setMainFile)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
    editor.currentProjectId.value = 'p1';
    editor.mainFile.value = 'main.tex';
  });

  afterEach(() => cleanup?.());

  it('updates mainFile after successful PATCH', async () => {
    api.mockResolvedValue({});
    await editor.setMainFile('other.tex');
    expect(editor.mainFile.value).toBe('other.tex');
  });
});

describe('useEditor (loadProjects)', () => {
  let editor;
  let cleanup;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    const mod = await import('@/composables/useEditor.js');
    editor = mod.useEditor(null);
    cleanup = editor.cleanup;
  });

  afterEach(() => cleanup?.());

  it('populates projects from API', async () => {
    api.mockResolvedValue({ projects: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    await editor.loadProjects();
    expect(editor.projects.value).toHaveLength(2);
    expect(editor.projects.value[0].name).toBe('A');
  });
});
