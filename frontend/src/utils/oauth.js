import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const NATIVE_OAUTH_REDIRECT = 'mathify://oauth/callback';

export async function startOAuth(provider, apiBase, webOrigin) {
  const redirect = Capacitor.isNativePlatform() ? NATIVE_OAUTH_REDIRECT : webOrigin;
  const url = `${apiBase}/api/accounts/oauth/${provider}/login/?frontend_redirect=${encodeURIComponent(redirect)}`;

  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }

  window.location.assign(url);
}