<script setup>
import { watch, nextTick, ref } from 'vue';

const props = defineProps({
  show: Boolean,
  maxWidth: { type: String, default: 'max-w-lg' },
});
const emit = defineEmits(['close']);
const panelRef = ref(null);

watch(
  () => props.show,
  (val) => {
    if (val)
      nextTick(() => {
        const el = panelRef.value?.querySelector('input, textarea, button:not([disabled])');
        el?.focus();
      });
  },
);

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close');
}
function onKeydown(e) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 z-[60] modal-backdrop flex items-center justify-center p-4"
        @mousedown="onBackdrop"
        @keydown="onKeydown"
        tabindex="-1"
      >
        <Transition name="scale" appear>
          <div
            v-if="show"
            ref="panelRef"
            :class="['modal-panel p-6 w-full max-h-[80vh] overflow-auto', maxWidth]"
            role="dialog"
            aria-modal="true"
          >
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
