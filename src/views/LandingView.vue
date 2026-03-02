<script setup>
import AppHeader from '@/components/AppHeader.vue';
import { useAuth } from '@/composables/useAuth.js';

const { isLoggedIn, displayName } = useAuth();
const year = new Date().getFullYear();

const features = [
  {
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    title: 'Проекты и файлы',
    desc: 'Создавайте проекты, управляйте файлами в одном месте',
  },
  {
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    title: 'Компиляция в PDF',
    desc: 'Мгновенная сборка LaTeX с подсветкой ошибок',
  },
  {
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z',
    title: 'Шаблоны',
    desc: 'Готовые шаблоны статей, отчётов и презентаций',
  },
  {
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'История версий',
    desc: 'Восстановление любой предыдущей версии файла',
  },
];
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader active-page="landing" />

    <main class="flex-1 flex flex-col relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          class="gradient-orb w-[500px] h-[500px] bg-leti-gold top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 absolute opacity-[0.07]"
        />
        <div
          class="gradient-orb w-[600px] h-[600px] bg-leti-blue-light bottom-0 right-0 translate-x-1/3 translate-y-1/3 absolute opacity-[0.1]"
        />
      </div>

      <!-- Hero -->
      <div class="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24 relative">
        <div class="text-center animate-fade-in-up">
          <div
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-leti-gold/10 border border-leti-gold/20 text-leti-gold text-xs font-medium mb-6"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
            Онлайн-редактор
          </div>
          <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 leading-tight">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-leti-gold to-leti-gold-light">LetuTEX</span>
          </h1>
          <p class="text-lg sm:text-xl text-white/45 max-w-xl mx-auto mb-10 leading-relaxed">
            Профессиональный онлайн-редактор LaTeX для студентов и преподавателей
          </p>
          <div v-if="!isLoggedIn" class="flex flex-wrap gap-3 justify-center">
            <RouterLink to="/login" class="btn-primary text-base px-8 py-3">Начать работу</RouterLink>
            <RouterLink to="/editor" class="btn-secondary text-base px-8 py-3 border-leti-gold/30 text-leti-gold"
              >Открыть редактор</RouterLink
            >
          </div>
          <div v-else>
            <p class="text-white/45 mb-4">
              Здравствуйте, <span class="text-white font-medium">{{ displayName }}</span>
            </p>
            <div class="flex flex-wrap gap-3 justify-center">
              <RouterLink to="/account" class="btn-primary text-base px-8 py-3">Личный кабинет</RouterLink>
              <RouterLink to="/editor" class="btn-secondary text-base px-8 py-3 border-leti-gold/30 text-leti-gold"
                >Редактор</RouterLink
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Features -->
      <div class="relative py-16 sm:py-20 px-4 sm:px-6">
        <div class="divider mb-16" />
        <h2 class="text-sm font-semibold text-white/60 text-center mb-10 uppercase tracking-[0.15em]">Возможности</h2>
        <div class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="(f, i) in features"
            :key="i"
            class="feature-card animate-fade-in-up"
            :style="{ animationDelay: `${i * 0.06}s` }"
          >
            <div
              class="w-12 h-12 rounded-xl bg-gradient-to-br from-leti-gold/15 to-leti-gold/5 border border-leti-gold/15 flex items-center justify-center mx-auto mb-3"
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" class="text-leti-gold">
                <path :d="f.icon" />
              </svg>
            </div>
            <h3 class="font-semibold text-white mb-1.5 text-sm">{{ f.title }}</h3>
            <p class="text-xs text-white/40 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <!-- How to start -->
      <div class="relative py-16 sm:py-20 px-4 sm:px-6">
        <div class="divider mb-16" />
        <h2 class="text-sm font-semibold text-white/60 text-center mb-10 uppercase tracking-[0.15em]">Как начать</h2>
        <div class="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div
            v-for="(step, i) in [
              { n: '1', t: 'Войдите', d: 'Используйте учётную запись или создайте новую' },
              { n: '2', t: 'Создайте проект', d: 'Выберите шаблон или начните с пустого документа' },
              { n: '3', t: 'Компилируйте', d: 'Нажмите Ctrl+Enter и получите PDF мгновенно' },
            ]"
            :key="i"
            class="text-center animate-fade-in-up"
            :style="{ animationDelay: `${i * 0.08}s` }"
          >
            <div
              class="w-10 h-10 rounded-full bg-leti-gold/15 border border-leti-gold/20 flex items-center justify-center mx-auto mb-3 text-leti-gold font-bold text-sm"
            >
              {{ step.n }}
            </div>
            <h3 class="font-semibold text-white text-sm mb-1">{{ step.t }}</h3>
            <p class="text-xs text-white/40 leading-relaxed">{{ step.d }}</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="flex-shrink-0 py-5 px-4 text-center text-xs text-white/25">LetuTEX · {{ year }}</footer>
  </div>
</template>
