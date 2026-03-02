<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';
import { useToast } from '@/composables/useToast.js';

const { login, register } = useAuth();
const { success } = useToast();
const router = useRouter();

const tab = ref('login');
const username = ref('');
const password = ref('');
const displayNameInput = ref('');
const errorMsg = ref('');
const loading = ref(false);

async function handleLogin() {
  errorMsg.value = '';
  loading.value = true;
  try {
    const user = await login(username.value.trim(), password.value);
    success(`Добро пожаловать, ${user.display_name || user.username}`);
    router.push('/account');
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  errorMsg.value = '';
  if (username.value.trim().length < 3) {
    errorMsg.value = 'Логин: мин. 3 символа';
    return;
  }
  if (password.value.length < 4) {
    errorMsg.value = 'Пароль: мин. 4 символа';
    return;
  }
  loading.value = true;
  try {
    await register(username.value.trim(), password.value, displayNameInput.value.trim() || username.value.trim());
    success('Аккаунт создан!');
    router.push('/account');
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-4" style="background: rgba(3, 26, 51, 0.97)">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="gradient-orb w-96 h-96 bg-leti-gold -top-32 -left-32 absolute" />
      <div class="gradient-orb w-80 h-80 bg-leti-blue-light -bottom-20 -right-20 absolute" />
    </div>
    <div class="modal-panel p-8 w-full max-w-sm relative animate-scale-in">
      <div class="flex items-center gap-3 mb-2">
        <div
          class="w-9 h-9 rounded-lg bg-gradient-to-br from-leti-gold to-leti-gold-dark flex items-center justify-center text-white font-bold text-sm shadow-[0_0_20px_rgba(187,141,84,0.15)]"
        >
          L
        </div>
        <h1 class="text-xl font-bold text-white">LetuTEX</h1>
      </div>
      <p class="text-white/40 text-sm mb-5">{{ tab === 'login' ? 'Войдите для работы' : 'Создайте аккаунт' }}</p>
      <div class="flex bg-white/[0.03] rounded-lg p-0.5 mb-5">
        <button
          :class="[
            'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'login' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60',
          ]"
          @click="
            tab = 'login';
            errorMsg = '';
          "
        >
          Вход
        </button>
        <button
          :class="[
            'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
            tab === 'register' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60',
          ]"
          @click="
            tab = 'register';
            errorMsg = '';
          "
        >
          Регистрация
        </button>
      </div>
      <form class="space-y-4" @submit.prevent="tab === 'login' ? handleLogin() : handleRegister()">
        <div>
          <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Логин</label
          ><input
            v-model="username"
            type="text"
            class="input-base"
            placeholder="Введите логин"
            required
            autocomplete="username"
          />
        </div>
        <div v-if="tab === 'register'">
          <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Имя</label
          ><input
            v-model="displayNameInput"
            type="text"
            class="input-base"
            placeholder="Как вас зовут?"
            autocomplete="name"
          />
        </div>
        <div>
          <label class="block text-[10px] font-semibold text-white/45 mb-1.5 uppercase tracking-wider">Пароль</label
          ><input
            v-model="password"
            type="password"
            class="input-base"
            placeholder="Введите пароль"
            required
            autocomplete="current-password"
          />
        </div>
        <Transition name="fade"
          ><p v-if="errorMsg" class="text-red-400 text-sm">{{ errorMsg }}</p></Transition
        >
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <span v-if="!loading">{{ tab === 'login' ? 'Войти' : 'Зарегистрироваться' }}</span>
          <span v-else class="flex items-center gap-2"
            ><span class="spinner" />{{ tab === 'login' ? 'Вход…' : 'Регистрация…' }}</span
          >
        </button>
      </form>
      <div class="divider my-5" />
      <p class="text-white/30 text-xs text-center">
        Демо: <code class="font-mono text-leti-gold/60 bg-white/5 px-1.5 py-0.5 rounded">demo</code> /
        <code class="font-mono text-leti-gold/60 bg-white/5 px-1.5 py-0.5 rounded">demo</code>
      </p>
      <p class="mt-3 text-center">
        <RouterLink to="/" class="text-sm text-leti-gold/60 hover:text-leti-gold transition-colors"
          >← На главную</RouterLink
        >
      </p>
    </div>
  </div>
</template>
