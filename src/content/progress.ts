import { t } from '../common/i18n';

export function showProgress(percent: number, text?: string): void {
  let el = document.getElementById('hxxtranslate-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hxxtranslate-progress';
    document.documentElement.appendChild(el);
  }
  const label = text ?? t('translating');
  el.textContent = `${label}\n${t('progressDone', { progress: Math.max(0, Math.min(100, Math.round(percent))) })}`;
}

export function hideProgress(): void {
  document.getElementById('hxxtranslate-progress')?.remove();
}
