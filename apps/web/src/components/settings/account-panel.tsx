'use client';

/**
 * 【账号】Tab：头像 + 用户名管理（经 account store 与侧边栏即时同步）。
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccountStore } from '@/stores/account';
import { removeAvatar, updateProfile, uploadAvatar } from '@/lib/account-api';
import { resolveServerAssetUrl } from '@/lib/server';
import { Avatar } from '../sidebar-rail/Avatar';

export function AccountPanel() {
  const t = useTranslations('settings');
  const name = useAccountStore((s) => s.name);
  const avatarUrl = useAccountStore((s) => s.avatarUrl);
  const load = useAccountStore((s) => s.load);
  const applyProfile = useAccountStore((s) => s.applyProfile);

  const [userName, setUserName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // store 中的资料被外部刷新（如侧边栏）时同步输入框
  useEffect(() => {
    setUserName(name);
  }, [name]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const profile = await updateProfile(userName.trim());
      applyProfile(profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await uploadAvatar(file);
      applyProfile({ name, avatarUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await removeAvatar();
      applyProfile({ name, avatarUrl: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{t('userAvatar')}</h3>
        <div className="flex items-center gap-4">
          <Avatar
            name={name}
            src={avatarUrl ? resolveServerAssetUrl(avatarUrl) : undefined}
            size="lg"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon aria-hidden="true" />
              {busy ? t('avatarUploading') : t('uploadAvatar')}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void handleRemove()}
              >
                <Trash2Icon aria-hidden="true" />
                {t('removeAvatar')}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = '';
            }}
          />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{t('userName')}</h3>
        <Input
          value={userName}
          placeholder={t('userNamePlaceholder')}
          onChange={(event) => setUserName(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={saving || busy || !userName.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? t('saving') : t('save')}
          </Button>
          {saved && !error && (
            <span className="text-sm text-muted-foreground">{t('saved')}</span>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </section>
    </div>
  );
}
