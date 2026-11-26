import { Router } from 'express';
import { getSecret, setSecret, getPassword, getAccessToken } from '../services/auth-store.js';

const router = Router();

router.post('/login', (req, res) => {
  // 新前端发 { password }；旧字段 { secret } 保留兼容
  const { password, secret } = req.body as { password?: string; secret?: string };
  const submitted = password ?? secret ?? '';
  const currentPassword = getPassword();

  // 免鉴权模式（未设密码且无 auth.json secret）：登录永远过不去会造成死锁
  //（前端进不去也设不了密码），与中间件空 accessToken 放行语义对齐，任意输入均放行。
  if (currentPassword === '') {
    res.json({ ok: true, token: getAccessToken() });
    return;
  }

  if (submitted === '' || submitted !== currentPassword) {
    res.status(403).json({ error: 'Invalid password' });
    return;
  }

  res.json({ ok: true, token: getAccessToken() });
});

router.get('/check', (_req, res) => {
  const accessToken = getAccessToken();
  const auth = _req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';

  res.json({
    authenticated: token !== '' && token === accessToken,
    secretSet: getSecret() !== '',
    passwordSet: getPassword() !== '',
    tokenSet: accessToken !== '',
  });
});

router.post('/change-secret', (req, res) => {
  const { newSecret, currentToken } = req.body as { newSecret?: string; currentToken?: string };
  const currentSecret = getSecret();

  if ((currentToken ?? '') !== currentSecret) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  setSecret(newSecret ?? '');
  res.json({ ok: true });
});

export default router;
