import jwt from 'jsonwebtoken';
import { getById } from '../infrastructure/userStore.js';
import { UnauthorizedError } from '../exceptions.js';
import { config } from '../config.js';

function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwtSecret);
      return payload.sub || null;
    } catch {
      return null;
    }
  }
  return req.headers['x-user-id'] || req.cookies?.user_id || null;
}

export async function getCurrentUser(req, _res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return next(new UnauthorizedError('Необходима авторизация'));
  }
  const user = await getById(userId);
  if (!user) {
    return next(new UnauthorizedError('Пользователь не найден'));
  }
  req.user = user;
  next();
}

export async function getCurrentUserOptional(req, _res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    req.user = null;
    return next();
  }
  const user = await getById(userId);
  req.user = user || null;
  next();
}
