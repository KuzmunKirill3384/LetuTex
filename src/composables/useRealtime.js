import { ref, shallowRef, onUnmounted } from 'vue';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth.js';

export function useRealtime() {
  const { getToken } = useAuth();
  const socket = shallowRef(null);
  const connected = ref(false);
  const otherUsers = ref([]);
  const realtimeEnabled = ref(false);

  function getRealtimeUrl() {
    const base = import.meta.env?.VITE_REALTIME_URL;
    if (base) return base;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }

  function connect(projectId, filePath, { onDoc, onOp, onCursor: _onCursor } = {}) {
    const url = getRealtimeUrl();
    if (!url) return Promise.resolve(null);
    const t = getToken();
    if (!t) return Promise.resolve(null);
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    return new Promise((resolve, reject) => {
      const s = io(url, {
        path: '/realtime',
        auth: { token: t },
        transports: ['websocket', 'polling'],
      });
      s.on('connect', () => {
        connected.value = true;
        realtimeEnabled.value = true;
        s.emit('join', { projectId, filePath }, (ack) => {
          if (ack?.error) {
            reject(new Error(ack.error));
            return;
          }
          if (ack?.content != null) onDoc?.(ack.content);
          resolve(s);
        });
      });
      s.on('connect_error', (err) => {
        connected.value = false;
        reject(err);
      });
      s.on('disconnect', () => {
        connected.value = false;
        otherUsers.value = [];
      });
      s.on('op', (op, userId) => onOp?.(op, userId));
      s.on('cursor', (data) => {
        otherUsers.value = (otherUsers.value.filter((u) => u.userId !== data.userId)).concat([data]);
      });
      socket.value = s;
    });
  }

  function sendOp(op) {
    if (!socket.value?.connected) return;
    socket.value.emit('op', op, () => {});
  }

  function sendCursor(pos) {
    if (!socket.value?.connected) return;
    socket.value.emit('cursor', pos);
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
    connected.value = false;
    realtimeEnabled.value = false;
    otherUsers.value = [];
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    connected,
    otherUsers,
    realtimeEnabled,
    connect,
    sendOp,
    sendCursor,
    disconnect,
    getRealtimeUrl,
  };
}

export function applyOpToContent(content, op) {
  if (!content || !op) return content;
  if (op.type === 'insert' && typeof op.pos === 'number' && op.text != null) {
    const pos = Math.max(0, Math.min(op.pos, content.length));
    return content.slice(0, pos) + op.text + content.slice(pos);
  }
  if (op.type === 'delete' && typeof op.pos === 'number' && typeof op.len === 'number') {
    const pos = Math.max(0, Math.min(op.pos, content.length));
    const end = Math.min(content.length, pos + op.len);
    return content.slice(0, pos) + content.slice(end);
  }
  return content;
}
