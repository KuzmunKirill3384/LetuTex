import { ref, computed } from 'vue';
import { api } from './useApi.js';

const user = ref(null);
const token = ref(null);

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value);
  const displayName = computed(() => user.value?.display_name || user.value?.username || '');

  function getToken() {
    return token.value;
  }

  async function checkAuth() {
    try {
      user.value = await api('/api/auth/me');
      return true;
    } catch {
      user.value = null;
      token.value = null;
      return false;
    }
  }

  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Неверный логин или пароль');
    user.value = data.user;
    token.value = data.token || null;
    return data.user;
  }

  async function register(username, password, displayNameVal) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, display_name: displayNameVal || username }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Ошибка регистрации');
    user.value = data.user;
    token.value = data.token || null;
    return data.user;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    user.value = null;
    token.value = null;
  }

  return { user, isLoggedIn, displayName, getToken, checkAuth, login, register, logout };
}
