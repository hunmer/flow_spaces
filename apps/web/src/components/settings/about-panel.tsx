import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RiRefreshLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Badge } from '@/components/base/badges/badge';
import appIcon from '../../../build/icon.png';
import { getAppInfoClient, type AppInfo, type AppUpdate } from '@/lib/app-info';

export function AboutPanel() {
  const t = useTranslations('settings');
  const [info, setInfo] = useState<AppInfo>();
  const [result, setResult] = useState<AppUpdate>();
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => getAppInfoClient().getInfo()).then(
      value => { if (active) setInfo(value); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, []);

  async function checkUpdate() {
    setChecking(true);
    setFailed(false);
    setResult(undefined);
    try {
      const update = await getAppInfoClient().checkUpdate();
      setInfo(update);
      setResult(update);
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 py-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <img src={appIcon} alt="Flow Spaces" width={96} height={96} className="mb-2 size-24 shrink-0 object-contain" />
        <h3 className="text-title-3-medium text-text-primary">Flow Spaces</h3>
        <p className="text-body-2-regular text-text-secondary">{t('aboutDescription')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge className="rounded-full px-3 py-1" title={t('aboutVersion')} aria-label={`${t('aboutVersion')}: ${info?.version ?? '—'}`}>
          {info ? `v${info.version}` : '—'}
        </Badge>
        <Badge className="rounded-full px-3 py-1" title={t('aboutPlatform')}>
          {info ? `${info.runtime === 'electron' ? 'Electron' : 'npm'} · ${info.platform}` : '—'}
        </Badge>
        {result?.latestVersion && <Badge className="rounded-full px-3 py-1">{t('aboutLatestVersion')} · v{result.latestVersion}</Badge>}
      </div>
      <div className="flex max-w-full flex-col items-center gap-3">
        <Button variant="secondary" leadingIcon={RiRefreshLine} disabled={checking} onClick={checkUpdate}>
          {checking ? t('aboutChecking') : t('aboutCheckNow')}
        </Button>
        <div aria-live="polite" className="text-body-2-regular text-text-secondary">
          {failed ? <p role="alert" className="text-text-error-primary">{t('aboutCheckFailed')}</p>
            : result?.disabled ? t('aboutDevMode')
            : result ? result.updateAvailable ? t('aboutNewVersion', { version: result.latestVersion! }) : t('aboutUpToDate') : null}
        </div>
        {result?.updateAvailable && info?.runtime === 'npm' && <code dir="ltr" className="max-w-full break-all text-body-2-regular text-text-primary">npm install -g {info.packageName}@latest</code>}
      </div>
    </div>
  );
}
