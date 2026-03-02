import { Router } from 'express';
import { authenticate, register, userExists } from '../infrastructure/userStore.js';
import { getCurrentUserOptional } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Логин и пароль обязательны' });
  const user = authenticate(username, password);
  if (!user) return res.status(401).json({ ok: false, error: 'Неверный логин или пароль' });
  res.cookie('user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, user });
});

router.post('/register', (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Логин и пароль обязательны' });
  if (username.length < 3) return res.status(400).json({ ok: false, error: 'Логин должен быть не менее 3 символов' });
  if (password.length < 4) return res.status(400).json({ ok: false, error: 'Пароль должен быть не менее 4 символов' });
  if (userExists(username)) return res.status(409).json({ ok: false, error: 'Пользователь уже существует' });
  const user = register(username, password, display_name || username);
  if (!user) return res.status(500).json({ ok: false, error: 'Ошибка регистрации' });
  res.cookie('user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.status(201).json({ ok: true, user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('user_id');
  res.json({ ok: true });
});

router.get('/me', getCurrentUserOptional, (req, res) => {
  if (!req.user) return res.status(401).json({ detail: 'Not authenticated' });
  res.json(req.user);
});

export default router;
