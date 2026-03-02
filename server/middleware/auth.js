import { getById } from '../infrastructure/userStore.js';
import { UnauthorizedError } from '../exceptions.js';

export function getCurrentUser(req, _res, next) {
  const userId = req.headers['x-user-id'] || req.cookies?.user_id;
  if (!userId) {
    return next(new UnauthorizedError('Необходима авторизация'));
  }
  const user = getById(userId);
  if (!user) {
    return next(new UnauthorizedError('Пользователь не найден'));
  }
  req.user = user;
  next();
}

export function getCurrentUserOptional(req, _res, next) {
  const userId = req.headers['x-user-id'] || req.cookies?.user_id;
  if (!userId) {
    req.user = null;
    return next();
  }
  const user = getById(userId);
  req.user = user || null;
  next();
}
