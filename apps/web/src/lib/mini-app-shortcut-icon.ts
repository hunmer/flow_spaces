import { fetchWithAuth } from './auth';

/** Render avatars, emoji, and name initials into the PNG used by a desktop shortcut. */
export async function miniAppShortcutIcon(name: string, icon?: string, avatarUrl?: string): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  let avatar: HTMLImageElement | undefined;
  if (avatarUrl) {
    const response = await fetchWithAuth(avatarUrl);
    if (!response.ok) throw new Error('Failed to load mini app avatar');
    const url = URL.createObjectURL(await response.blob());
    try {
      avatar = new Image();
      avatar.src = url;
      await avatar.decode();
      const size = Math.min(avatar.naturalWidth, avatar.naturalHeight);
      context.drawImage(avatar, (avatar.naturalWidth - size) / 2, (avatar.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    } finally {
      URL.revokeObjectURL(url);
    }
  } else {
    context.font = '192px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon || name.charAt(0).toUpperCase() || '?', 128, 140, 240);
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Failed to encode shortcut icon')), 'image/png');
  });
  return blob.arrayBuffer();
}
