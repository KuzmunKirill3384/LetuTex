<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="toggle-switch"
    :class="{ 'toggle-switch-on': modelValue, 'toggle-switch-disabled': disabled }"
    @click="!disabled && emit('update:modelValue', !modelValue)"
    @keydown.space.prevent="!disabled && emit('update:modelValue', !modelValue)"
  >
    <span class="toggle-switch-thumb" />
  </button>
</template>

<style scoped>
.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-switch:hover:not(.toggle-switch-disabled) {
  background: rgba(255, 255, 255, 0.15);
}
.toggle-switch-on {
  background: linear-gradient(135deg, #bb8d54 0%, #d4a84b 100%);
}
.toggle-switch-on:hover:not(.toggle-switch-disabled) {
  background: linear-gradient(135deg, #c99a5e 0%, #ddb055 100%);
  box-shadow: 0 0 12px rgba(187, 141, 84, 0.35);
}
.toggle-switch-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toggle-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-switch-on .toggle-switch-thumb {
  transform: translateX(16px);
}
.toggle-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #031a33, 0 0 0 4px rgba(187, 141, 84, 0.5);
}
</style>
