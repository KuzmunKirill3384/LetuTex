<script setup>
import { useToast } from '@/composables/useToast.js';

const { toasts, dismiss } = useToast();

const icons = {
  success: 'M3 8.5l3.5 3.5L13 5',
  error: 'M6 6l4 4M10 6l-4 4',
  info: 'M8 7v4M8 5.5v.01',
  warning: 'M8 2L1 14h14L8 2zM8 6v4M8 12v.01',
};

const styles = {
  success: 'bg-green-500/10 border-green-500/25 text-green-400',
  error: 'bg-red-500/10 border-red-500/25 text-red-400',
  info: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  warning: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
};
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[
            'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm shadow-lg backdrop-blur-xl pointer-events-auto cursor-pointer min-w-[280px] max-w-[400px]',
            styles[t.type] || styles.info,
          ]"
          @click="dismiss(t.id)"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0">
            <circle v-if="t.type === 'error'" cx="8" cy="8" r="6" />
            <circle v-if="t.type === 'info'" cx="8" cy="8" r="6" />
            <path :d="icons[t.type] || icons.info" />
          </svg>
          <span class="flex-1">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
