import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// Must run before any other imports (especially express)
dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'development',
});
