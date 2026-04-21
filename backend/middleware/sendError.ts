import * as Sentry from '@sentry/node';
import { Response } from 'express';

/**
 * Capture an error to Sentry and respond with a JSON 500.
 * Use this in every route's catch block instead of calling
 * res.status(500).json(...) directly so backend errors always
 * reach Sentry regardless of whether they go through next(err).
 */
export function sendError(res: Response, err: unknown): Response {
  Sentry.captureException(err);
  return res.status(500).json({ success: false, error: (err as Error).message });
}
