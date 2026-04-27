import * as Sentry from '@sentry/react';

const isSentryEnabled = import.meta.env.PROD;

export function initSentry() {
  if (!isSentryEnabled) return;

  Sentry.init({
    dsn: 'https://d79dd093cfddb2b41c149fe004c50ef1@o4511122905628672.ingest.us.sentry.io/4511126165454848',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    ignoreErrors: [
      // Injected by Zalo in-app browser (iOS WebView) — not our code
      /zaloJSV2/,
      /isReCreate is not defined/,
    ],
  });
}
