import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// Must run before any other imports (especially express)
dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'development',
  includeLocalVariables: true,
  integrations: [
    // Required for Express request context (route, method, url) in Sentry events
    Sentry.expressIntegration(),
    // Capture full request body in Sentry events
    Sentry.requestDataIntegration({
      include: {
        data: true,
        headers: true,
        ip: true,
        url: true,
        user: false,
      },
    }),
  ],
});
