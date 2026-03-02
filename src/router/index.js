import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';

const routes = [
  { path: '/', name: 'landing', component: () => import('@/views/LandingView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/account', name: 'account', component: () => import('@/views/AccountView.vue'), meta: { auth: true } },
  {
    path: '/editor/:projectId?',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
    meta: { auth: true },
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const { isLoggedIn } = useAuth();
  if (to.meta.auth && !isLoggedIn.value) return { name: 'login' };
  if (to.name === 'login' && isLoggedIn.value) return { name: 'account' };
});

export default router;
