import { getAuth, getSettings } from '../common/storage';
import { resolveSiteBase } from '../common/types';

export class ApiError extends Error {
  status: number;
  code?: string;
  subscribeUrl?: string;
  traceId?: string;
  providerCode?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    subscribeUrl?: string,
    traceId?: string,
    providerCode?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.subscribeUrl = subscribeUrl;
    this.traceId = traceId;
    this.providerCode = providerCode;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = await getSettings();
  const auth = await getAuth();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (auth?.accessToken) {
    headers.set('Authorization', `Bearer ${auth.accessToken}`);
  }
  // 登录页 /auth 在前端站点，不能把 API :8080 当成网站源
  headers.set('X-Desktop-Web-Origin', resolveSiteBase(settings));
  const res = await fetch(`${settings.apiBase.replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
    subscribe_url?: string;
    success?: boolean;
    trace_id?: string;
    provider_code?: string;
  };
  const toError = () =>
    new ApiError(
      data.error || `请求失败 (${res.status})`,
      res.status,
      data.code,
      data.subscribe_url,
      data.trace_id,
      data.provider_code,
    );
  if (!res.ok) {
    throw toError();
  }
  if (data && typeof data === 'object' && 'success' in data && data.success === false) {
    throw toError();
  }
  return data;
}
