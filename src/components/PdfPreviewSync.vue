<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { getDocument } from 'pdfjs-dist';
import { api } from '@/composables/useApi.js';

const props = defineProps({
  pdfUrl: { type: String, default: '' },
  projectId: { type: String, default: '' },
});

const emit = defineEmits(['goto']);

const container = ref(null);
const loading = ref(true);
const error = ref('');
let pdfDoc = null;
let pageCanvases = [];
const scale = 1.2;

async function loadPdf() {
  if (!props.pdfUrl) return;
  loading.value = true;
  error.value = '';
  try {
    pdfDoc = await getDocument({ url: props.pdfUrl, withCredentials: true }).promise;
    renderPages();
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить PDF';
  } finally {
    loading.value = false;
  }
}

async function renderPages() {
  if (!container.value || !pdfDoc) return;
  container.value.innerHTML = '';
  pageCanvases = [];
  const numPages = pdfDoc.numPages;
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const div = document.createElement('div');
    div.className = 'pdf-page-wrapper';
    div.style.marginBottom = '8px';
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.dataset.page = String(i);
    canvas.style.cursor = 'pointer';
    div.appendChild(canvas);
    container.value.appendChild(div);
    page.render({ canvasContext: canvas.getContext('2d'), viewport });
    pageCanvases.push({ page: i, canvas, viewport });
    canvas.addEventListener('click', (e) => onPageClick(e, i, viewport));
  }
}

function onPageClick(e, pageNum, viewport) {
  if (!props.projectId) return;
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (viewport.width / rect.width);
  const y = viewport.height - (e.clientY - rect.top) * (viewport.height / rect.height);
  api(`/api/projects/${props.projectId}/synctex-inverse?page=${pageNum}&x=${Math.round(x)}&y=${Math.round(y)}`)
    .then((data) => {
      if (data?.file != null && data?.line != null) emit('goto', { file: data.file, line: data.line });
    })
    .catch(() => {});
}

watch(
  () => props.pdfUrl,
  () => {
    loadPdf();
  },
  { immediate: true },
);
onUnmounted(() => {
  pdfDoc = null;
  pageCanvases = [];
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 overflow-auto bg-neutral-800 p-2">
    <div v-if="loading" class="flex items-center justify-center flex-1 text-white/30 text-sm">Загрузка PDF…</div>
    <div v-else-if="error" class="flex items-center justify-center flex-1 text-red-400/70 text-sm">{{ error }}</div>
    <div v-else ref="container" class="flex flex-col items-center" />
  </div>
</template>
