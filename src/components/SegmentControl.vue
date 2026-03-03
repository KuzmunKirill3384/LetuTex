<script setup>
defineProps({
  options: { type: Array, default: () => [] },
  modelValue: { type: [String, Number], default: null },
  optionActiveClass: { type: Function, default: null },
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="segment-control" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      :class="[
        'segment-control-btn',
        { 'segment-control-btn-active': modelValue === opt.value },
        optionActiveClass?.(opt, modelValue === opt.value),
      ]"
      @click="emit('update:modelValue', opt.value)"
    >
      <svg v-if="opt.icon" class="segment-control-icon" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5">
        <path :d="opt.icon" />
      </svg>
      <span v-if="opt.label" class="segment-control-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.segment-control {
  display: inline-flex;
  border-radius: 6px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(109, 110, 113, 0.2);
}
.segment-control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  cursor: pointer;
  transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.segment-control-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}
.segment-control-btn-active {
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.segment-control-icon {
  flex-shrink: 0;
}
.segment-control-label {
  white-space: nowrap;
}
.segment-control-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #031a33, 0 0 0 3px rgba(187, 141, 84, 0.4);
}
</style>
