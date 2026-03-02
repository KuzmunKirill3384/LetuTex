<script setup>
import AppHeader from '@/components/AppHeader.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex flex-col items-center justify-center px-4">
      <div class="text-center animate-fade-in-up">
        <div class="text-6xl font-bold text-white/10 mb-4">404</div>
        <h1 class="text-xl font-semibold text-white mb-2">Страница не найдена</h1>
        <p class="text-white/40 mb-8">Проверьте адрес или вернитесь на главную</p>
        <RouterLink to="/" class="btn-primary">На главную</RouterLink>
      </div>
    </main>
  </div>
</template>
