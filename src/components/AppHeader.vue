<script setup>
import { ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth.js';
import { useRouter, useRoute } from 'vue-router';

defineProps({
  activePage: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const { isLoggedIn, displayName, logout } = useAuth();
const router = useRouter();
const route = useRoute();
const mobileOpen = ref(false);

watch(
  () => route.path,
  () => {
    mobileOpen.value = false;
  },
);

async function handleLogout() {
  mobileOpen.value = false;
  await logout();
  router.push('/');
}
function navTo(path) {
  mobileOpen.value = false;
  router.push(path);
}
</script>

<template>
  <header
    class="app-header flex-shrink-0 flex items-center justify-between px-4 sm:px-5 relative"
    :class="compact ? 'h-11' : 'min-h-14 py-2'"
  >
    <RouterLink to="/" class="flex items-center gap-2 group" @click="mobileOpen = false">
      <div
        class="rounded-lg bg-gradient-to-br from-leti-gold to-leti-gold-dark flex items-center justify-center text-white font-bold shadow-[0_0_16px_rgba(187,141,84,0.15)] transition-transform group-hover:scale-105"
        :class="compact ? 'w-6 h-6 text-[9px] rounded-md' : 'w-8 h-8 text-xs'"
      >
        L
      </div>
      <span v-if="!compact" class="font-semibold text-white hidden sm:inline">LetuTEX</span>
    </RouterLink>

    <nav class="hidden sm:flex items-center gap-1">
      <RouterLink to="/" :class="['nav-link', { active: activePage === 'landing' }]">Главная</RouterLink>
      <template v-if="isLoggedIn">
        <RouterLink to="/account" :class="['nav-link', { active: activePage === 'account' }]">Кабинет</RouterLink>
        <RouterLink to="/editor" :class="['nav-link', { active: activePage === 'editor' }]">Редактор</RouterLink>
        <span v-if="!compact" class="text-sm text-white/30 px-1.5">{{ displayName }}</span>
        <button class="btn-ghost-sm text-white/40 hover:text-white/60" @click="handleLogout">Выход</button>
      </template>
      <template v-else>
        <RouterLink to="/editor" class="nav-link">Редактор</RouterLink>
        <RouterLink to="/login" class="btn-primary-sm ml-1">Войти</RouterLink>
      </template>
    </nav>

    <button
      class="sm:hidden w-8 h-8 flex items-center justify-center rounded-md text-white/50 hover:bg-white/5"
      @click="mobileOpen = !mobileOpen"
    >
      <svg v-if="!mobileOpen" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 5h12M3 9h12M3 13h12" />
      </svg>
      <svg v-else width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 5l8 8M13 5l-8 8" />
      </svg>
    </button>

    <Transition name="slide-fade">
      <div
        v-if="mobileOpen"
        class="absolute top-full left-0 right-0 z-50 glass-dark border-b border-white/10 p-4 flex flex-col gap-2 sm:hidden"
      >
        <button class="nav-link text-left w-full" @click="navTo('/')">Главная</button>
        <template v-if="isLoggedIn">
          <button class="nav-link text-left w-full" @click="navTo('/account')">Кабинет</button>
          <button class="nav-link text-left w-full" @click="navTo('/editor')">Редактор</button>
          <div class="divider my-1" />
          <span class="text-sm text-white/30 px-2">{{ displayName }}</span>
          <button class="nav-link text-left w-full text-red-400/70" @click="handleLogout">Выход</button>
        </template>
        <template v-else>
          <button class="nav-link text-left w-full" @click="navTo('/editor')">Редактор</button>
          <button class="btn-primary w-full mt-1" @click="navTo('/login')">Войти</button>
        </template>
      </div>
    </Transition>
  </header>
</template>
