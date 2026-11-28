import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RiRefreshLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-title-3-medium text-text-primary">Flow Spaces</h3>
        <p className="text-body-2-regular text-text-secondary">{t('aboutDescription')}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-body-2-regular text-text-primary">
        <dt className="text-text-secondary">{t('aboutVersion')}</dt><dd>{info?.version ?? '—'}</dd>
        <dt className="text-text-secondary">{t('aboutPlatform')}</dt><dd>{info ? `${info.runtime === 'electron' ? 'Electron' : 'npm'} · ${info.platform}` : '—'}</dd>
        {result?.latestVersion && <><dt className="text-text-secondary">{t('aboutLatestVersion')}</dt><dd>{result.latestVersion}</dd></>}
      </dl>
      <div className="flex flex-col items-start gap-3">
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
