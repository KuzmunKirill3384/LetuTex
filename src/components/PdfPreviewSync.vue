<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  pdfUrl: { type: String, default: '' },
  projectId: { type: String, default: '' },
  syncPage: { type: Number, default: 0 },
});

defineEmits(['goto']);

const iframeKey = ref(0);

const embedUrl = computed(() => {
  if (!props.pdfUrl) return '';
  if (props.syncPage > 0) return `${props.pdfUrl}#page=${props.syncPage}`;
  return props.pdfUrl;
});

function reload() {
  iframeKey.value++;
}

defineExpose({ reload });
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 bg-neutral-800">
    <div v-if="!pdfUrl" class="flex items-center justify-center flex-1 text-white/30 text-sm">
      Нет PDF для отображения
    </div>
    <iframe
      v-else
      :key="iframeKey"
      :src="embedUrl"
      class="flex-1 w-full border-0 bg-white"
      title="PDF Preview"
    />
  </div>
</template>
