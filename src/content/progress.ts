export function showProgress(percent: number, text = '正在翻译…'): void {
  let el = document.getElementById('hxxtranslate-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hxxtranslate-progress';
    document.documentElement.appendChild(el);
  }
  el.textContent = `${text}\n已完成 ${Math.max(0, Math.min(100, Math.round(percent)))}%`;
}

export function hideProgress(): void {
  document.getElementById('hxxtranslate-progress')?.remove();
}
