import { Router } from 'express';
import { checkNpmUpdate, getAppInfo } from '../services/app-info.js';

const router = Router();
router.get('/', (_req, res) => res.json(getAppInfo()));
router.post('/check-update', async (_req, res) => {
  try {
    res.json(await checkNpmUpdate());
  } catch (error) {
    console.error('[app-info] npm update check failed:', error);
    res.status(502).json({ error: 'npm update check failed' });
  }
});
export default router;
