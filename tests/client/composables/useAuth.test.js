import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/composables/useApi.js', () => ({ api: vi.fn() }));

const { api } = await import('@/composables/useApi.js');

describe('useAuth (state after auth actions)', () => {
  let auth;
  let user;
  let getToken;
  let login;
  let logout;
  let checkAuth;

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    global.fetch = vi.fn();
    const mod = await import('@/composables/useAuth.js');
    auth = mod.useAuth();
    user = auth.user;
    getToken = auth.getToken;
    login = auth.login;
    logout = auth.logout;
    checkAuth = auth.checkAuth;
  });

  it('login sets user and token on success', async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, user: { id: 'u1', username: 'u' }, token: 't1' }),
    });
    await login('u', 'p');
    expect(user.value).toEqual({ id: 'u1', username: 'u' });
    expect(getToken()).toBe('t1');
  });

  it('login throws and does not set user on failure', async () => {
    user.value = null;
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: false, error: 'Bad' }),
    });
    await expect(login('u', 'wrong')).rejects.toThrow();
    expect(user.value).toBeNull();
  });

  it('logout clears user and token', async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, user: { id: 'u1' }, token: 't1' }),
    });
    await login('u', 'p');
    expect(user.value).not.toBeNull();
    expect(getToken()).toBe('t1');
    fetch.mockResolvedValueOnce({});
    await logout();
    expect(user.value).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('checkAuth sets user when /api/auth/me returns', async () => {
    api.mockResolvedValueOnce({ id: 'u1', username: 'u' });
    const ok = await checkAuth();
    expect(ok).toBe(true);
    expect(user.value).toEqual({ id: 'u1', username: 'u' });
  });

  it('checkAuth clears user and returns false on error', async () => {
    user.value = { id: 'u1' };
    api.mockRejectedValueOnce(new Error('Unauthorized'));
    const ok = await checkAuth();
    expect(ok).toBe(false);
    expect(user.value).toBeNull();
    expect(getToken()).toBeNull();
  });
});
