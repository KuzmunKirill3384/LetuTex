import { ref } from 'vue';

const toasts = ref([]);
let nextId = 0;

export function useToast() {
  function show(message, type = 'info', duration = 4000) {
    const id = ++nextId;
    toasts.value.push({ id, message, type });
    setTimeout(() => dismiss(id), duration);
  }

  function dismiss(id) {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) toasts.value.splice(idx, 1);
  }

  function success(msg) {
    show(msg, 'success');
  }
  function error(msg) {
    show(msg, 'error');
  }
  function info(msg) {
    show(msg, 'info');
  }
  function warning(msg) {
    show(msg, 'warning');
  }

  return { toasts, show, dismiss, success, error, info, warning };
}
