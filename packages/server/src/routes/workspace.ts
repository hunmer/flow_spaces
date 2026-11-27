import { Router } from 'express';
import { listWorkspaces } from '../storage/workspace-store.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listWorkspaces());
});

export default router;
