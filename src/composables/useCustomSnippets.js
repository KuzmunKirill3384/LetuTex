import { ref, watch } from 'vue';

const STORAGE_KEY = 'leti-custom-snippets';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full or unavailable */
  }
}

export function useCustomSnippets() {
  const customSnippets = ref(load());

  watch(
    customSnippets,
    (val) => {
      save(val);
    },
    { deep: true },
  );

  function addSnippet({ label, title, snippet }) {
    const item = { label: label || '?', title: title || label || 'Сниппет', snippet: snippet || '' };
    customSnippets.value = [...customSnippets.value, item];
  }

  function removeSnippet(index) {
    customSnippets.value = customSnippets.value.filter((_, i) => i !== index);
  }

  return { customSnippets, addSnippet, removeSnippet };
}
