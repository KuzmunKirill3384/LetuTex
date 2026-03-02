import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { useAuth } from './composables/useAuth.js';
import './assets/style.css';

import 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/mode-latex';
import 'ace-builds/src-min-noconflict/theme-chrome';
import 'ace-builds/src-min-noconflict/ext-language_tools';

const app = createApp(App);
app.use(router);

const { checkAuth } = useAuth();
checkAuth().finally(() => {
  app.mount('#app');
});
