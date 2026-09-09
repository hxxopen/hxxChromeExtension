import { CLIENT_ID } from '../common/types';
import { apiFetch } from './client';
import { fetchAccount } from './account';
import { getSettings, saveAuth } from '../common/storage';

function getRedirectUri(): string {
  return chrome.identity.getRedirectURL();
}

export async function loginWithHxxBot(): Promise<void> {
  const settings = await getSettings();
  const redirectUri = getRedirectUri();
  const init = await apiFetch<{ login_url: string; state: string }>('/api/auth/desktop/init', {
    method: 'POST',
    body: JSON.stringify({
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
    }),
  });

  const loginUrl = init.login_url.startsWith('http')
    ? init.login_url
    : `${settings.apiBase.replace(/\/$/, '')}${init.login_url}`;

  const redirected = await chrome.identity.launchWebAuthFlow({
    url: loginUrl,
    interactive: true,
  });
  if (!redirected) {
    throw new Error('登录已取消');
  }

  const result = new URL(redirected);
  const code = result.searchParams.get('code');
  const state = result.searchParams.get('state') || init.state;
  if (!code) {
    throw new Error('未获取到授权码');
  }

  const tokenRes = await apiFetch<{ token: string }>('/api/auth/desktop/token', {
    method: 'POST',
    body: JSON.stringify({
      code,
      state,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
    }),
  });

  await saveAuth({
    accessToken: tokenRes.token,
    userId: '',
    email: '',
  });

  const account = await fetchAccount();
  await saveAuth({
    accessToken: tokenRes.token,
    userId: String(account.user.id),
    email: account.user.email || '',
  });
}
