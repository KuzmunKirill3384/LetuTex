<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import { useAuth } from '@/composables/useAuth.js';
import { useToast } from '@/composables/useToast.js';
import { api } from '@/composables/useApi.js';

const { displayName } = useAuth();
const { success, error: showError } = useToast();
const router = useRouter();

const projects = ref([]);
const loading = ref(true);
const showNewModal = ref(false);
const newName = ref('Новый проект');
const templates = ref([]);
const creating = ref(false);

const searchQuery = ref('');
const sortBy = ref('date');
const showDeleteModal = ref(false);
const deleteId = ref('');
const deleteName = ref('');

const sortedProjects = computed(() => {
  let list = projects.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'ru');
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
});

async function loadProjects() {
  loading.value = true;
  try {
    const data = await api('/api/projects');
    projects.value = data.projects || [];
  } catch (e) {
    showError(e.message || 'Ошибка загрузки');
  } finally {
    loading.value = false;
  }
}

async function openNewModal() {
  newName.value = 'Новый проект';
  showNewModal.value = true;
  try {
    templates.value = (await api('/api/templates')).templates || [];
  } catch {
    templates.value = [];
  }
}

async function createProject(templateId = null) {
  creating.value = true;
  try {
    const body = { name: newName.value.trim() || 'Новый проект' };
    if (templateId) body.template_id = templateId;
    const p = await api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
    showNewModal.value = false;
    success('Проект создан');
    router.push({ name: 'editor', params: { projectId: p.id } });
  } catch (e) {
    showError(e.message);
  } finally {
    creating.value = false;
  }
}

function openProject(id) {
  router.push({ name: 'editor', params: { projectId: id } });
}

function confirmDeleteProject(id, name) {
  deleteId.value = id;
  deleteName.value = name;
  showDeleteModal.value = true;
}

async function doDeleteProject() {
  try {
    await api(`/api/projects/${deleteId.value}`, { method: 'DELETE' });
    showDeleteModal.value = false;
    success('Проект удалён');
    await loadProjects();
  } catch (e) {
    showError(e.message);
  }
}

function downloadProject(id) {
  window.open(`/api/projects/${id}/download`, '_blank');
}

function _formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

onMounted(loadProjects);
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader active-page="account" />

    <main class="flex-1 px-4 sm:px-6 py-8 sm:py-10 relative">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          class="gradient-orb w-[400px] h-[400px] bg-leti-gold top-0 right-0 -translate-y-1/2 translate-x-1/4 absolute opacity-[0.05]"
        />
      </div>

      <div class="max-w-5xl mx-auto relative">
        <div class="animate-fade-in-up">
          <h1 class="text-2xl font-bold text-white mb-1">Личный кабинет</h1>
          <p class="text-white/35 mb-6">{{ displayName }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3 mb-6 animate-fade-in-up" style="animation-delay: 0.05s">
          <button class="btn-primary" @click="openNewModal">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Новый проект
          </button>
          <RouterLink to="/editor" class="btn-secondary">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4v12h10V7l-3-3z" />
              <path d="M11 4v3h3" />
            </svg>
            В редактор
          </RouterLink>
          <div class="flex-1" />
          <div class="flex items-center gap-2">
            <div class="relative">
              <svg
                class="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <circle cx="6" cy="6" r="4.5" />
                <path d="M9.5 9.5L13 13" />
              </svg>
              <input v-model="searchQuery" class="input-base !min-h-[34px] !w-48 !pl-8 !text-sm" placeholder="Поиск…" />
            </div>
            <select v-model="sortBy" class="select-base !min-h-[34px] !w-auto !text-sm">
              <option value="date">По дате</option>
              <option value="name">По имени</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="skeleton h-40" />
        </div>

        <div v-else-if="!projects.length" class="text-center py-20 animate-fade-in">
          <div class="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" class="text-white/15">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p class="text-white/35 mb-4">Проектов пока нет</p>
          <button class="btn-primary" @click="openNewModal">Создать первый проект</button>
        </div>

        <TransitionGroup v-else name="list" tag="div" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProjectCard
            v-for="p in sortedProjects"
            :key="p.id"
            :project="p"
            @open="openProject"
            @delete="confirmDeleteProject(p.id, p.name)"
            @download="downloadProject(p.id)"
          />
        </TransitionGroup>

        <div v-if="!loading && searchQuery && !sortedProjects.length" class="text-center py-12 text-white/30 text-sm">
          Нет проектов, соответствующих «{{ searchQuery }}»
        </div>
      </div>
    </main>

    <footer class="flex-shrink-0 py-5 px-4 text-center text-xs text-white/25">LetuTEX</footer>

    <ModalDialog :show="showNewModal" @close="showNewModal = false">
      <h3 class="text-lg font-semibold text-white mb-4">Новый проект</h3>
      <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Название</label>
      <input
        v-model="newName"
        class="input-base mb-5"
        placeholder="Введите название"
        @keydown.enter="createProject(null)"
      />
      <div v-if="templates.length" class="mb-5">
        <label class="block text-[10px] font-semibold text-white/45 mb-2 uppercase tracking-wider">Шаблон</label>
        <div class="space-y-2 max-h-48 overflow-auto">
          <button
            v-for="t in templates"
            :key="t.id"
            class="card !p-3 text-left hover:!border-leti-gold/40 w-full"
            :disabled="creating"
            @click="createProject(t.id)"
          >
            <div class="font-medium text-white text-sm">{{ t.name }}</div>
            <div v-if="t.description" class="text-xs text-white/35 mt-0.5">{{ t.description }}</div>
          </button>
        </div>
      </div>
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showNewModal = false">Отмена</button>
        <button class="btn-primary-sm" :disabled="creating" @click="createProject(null)">
          <span v-if="!creating">Создать</span>
          <span v-else class="flex items-center gap-2"><span class="spinner" /> Создание…</span>
        </button>
      </div>
    </ModalDialog>

    <ModalDialog :show="showDeleteModal" @close="showDeleteModal = false">
      <h3 class="text-lg font-semibold text-white mb-2">Удалить проект</h3>
      <p class="text-sm text-white/45 mb-6">Удалить «{{ deleteName }}» и все его файлы? Это действие необратимо.</p>
      <div class="flex gap-3 justify-end">
        <button class="btn-secondary-sm" @click="showDeleteModal = false">Отмена</button>
        <button class="btn-danger-sm !bg-red-600 hover:!bg-red-500 !shadow-none !text-white" @click="doDeleteProject">
          Удалить
        </button>
      </div>
    </ModalDialog>
  </div>
</template>
