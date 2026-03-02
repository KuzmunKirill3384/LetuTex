<script setup>
defineProps({ project: { type: Object, required: true } });
defineEmits(['open', 'delete', 'download']);

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<template>
  <div class="card flex flex-col group">
    <div class="flex items-start justify-between mb-3">
      <div
        class="w-9 h-9 rounded-lg bg-leti-gold/10 border border-leti-gold/20 flex items-center justify-center flex-shrink-0"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" class="text-leti-gold">
          <path d="M3 4v8a1 1 0 001 1h8a1 1 0 001-1V6.5L9.5 3H4a1 1 0 00-1 1z" />
          <path d="M9.5 3v3.5H13" />
        </svg>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
          title="Скачать"
          @click.stop="$emit('download')"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 8v2h6V8M6 2v6M4 6l2 2 2-2" />
          </svg>
        </button>
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-red-400/30 hover:text-red-400 hover:bg-red-400/5 transition-all"
          title="Удалить"
          @click.stop="$emit('delete')"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 4h8M4 4V3h4v1M3 4l.5 6h5l.5-6" />
          </svg>
        </button>
      </div>
    </div>
    <h3 class="font-semibold text-white text-sm mb-0.5">{{ project.name }}</h3>
    <div class="flex items-center gap-3 text-[10px] text-white/20 mb-4">
      <span v-if="project.updated_at">{{ formatDate(project.updated_at) }}</span>
      <span v-if="project.file_count != null" class="flex items-center gap-0.5">
        <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M7 1H3v8h6V3l-2-2z" />
        </svg>
        {{ project.file_count }}
      </span>
    </div>
    <button
      class="mt-auto btn-secondary text-sm w-full border-leti-gold/20 text-leti-gold hover:text-leti-gold-light"
      @click="$emit('open', project.id)"
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M11 4H4v10h10V7l-3-3z" />
        <path d="M11 4v3h3" />
      </svg>
      Открыть
    </button>
  </div>
</template>
