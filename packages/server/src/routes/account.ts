import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { getProfile, updateName, setAvatarFromBuffer, removeAvatar, readAvatarFile } from '../services/user-profile-store.js';

const router = Router();

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE },
});

// multer 出错（如超 5MB、缺字段）统一 400，避免落到全局 500
function withAvatarUpload(req: Request, res: Response, next: NextFunction) {
  avatarUpload.single('file')(req, res, (err?: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'avatar upload failed';
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

router.get('/profile', (_req, res) => {
  res.json(getProfile());
});

router.put('/profile', (req, res) => {
  const { name } = req.body as { name?: string };
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed === '' || trimmed.length > 32) {
    res.status(400).json({ error: 'name must be 1-32 characters (trimmed)' });
    return;
  }
  res.json(updateName(trimmed));
});

router.post('/avatar', withAvatarUpload, (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }
  const ext = ALLOWED_MIME[(file.mimetype ?? '').toLowerCase()];
  if (!ext) {
    res.status(400).json({ error: 'Unsupported avatar image type (png/jpg/jpeg/webp/gif only)' });
    return;
  }
  const url = setAvatarFromBuffer(file.buffer, ext);
  res.json({ url });
});

router.delete('/avatar', (_req, res) => {
  removeAvatar();
  res.json({ ok: true });
});

// 静态头像：免鉴权放行（见 middleware/auth.ts openPaths），供 <img src> 直接引用
router.get('/avatar', (_req, res) => {
  const avatar = readAvatarFile();
  if (!avatar) {
    res.status(404).json({ error: 'Avatar not found' });
    return;
  }
  res.setHeader('Content-Type', avatar.contentType);
  res.setHeader('Cache-Control', 'no-cache');
  res.end(avatar.data);
});

export default router;
