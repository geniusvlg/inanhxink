import * as Sentry from '@sentry/react';

export const isSentryEnabled = import.meta.env.PROD;

export function initSentry() {
  if (!isSentryEnabled) return;

  Sentry.init({
    dsn: 'https://f6b4ae47b95a7577db9050db194023b7@o4511122905628672.ingest.us.sentry.io/4511126172794880',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

export function captureException(err: unknown) {
  if (isSentryEnabled) {
    Sentry.captureException(err);
  }
}
