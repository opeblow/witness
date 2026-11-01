import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { ApiError } from './errors.js';
import { RateLimiter } from './rate-limit.js';
import type { NotaryService } from './service.js';

export interface AppOptions {
  readonly allowedOrigins: readonly string[];
  readonly rateLimitPerMinute: number;
  readonly signerLimitPerHour: number;
  readonly now?: () => number;
  readonly log?: (entry: Record<string, unknown>) => void;
}

const CaptureRequest = z.object({ envelope: z.string().min(1).max(140_000) }).strict();

/** HTTP surface of the notary. Kept thin: parsing, limits and error mapping only. */
export function createApp(service: NotaryService, options: AppOptions): Hono {
  const app = new Hono();
  const log = options.log ?? ((entry) => console.info(JSON.stringify(entry)));
  const ipLimiter = new RateLimiter(options.rateLimitPerMinute, 60_000, options.now);
  const signerLimiter = new RateLimiter(options.signerLimitPerHour, 3_600_000, options.now);
  const anyOrigin = options.allowedOrigins.includes('*');

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: anyOrigin ? '*' : [...options.allowedOrigins],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type'],
      maxAge: 600,
    }),
  );

  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/v1/info', (c) => c.json(service.info()));

  app.post(
    '/v1/captures',
    bodyLimit({
      maxSize: 160 * 1024,
      onError: () => {
        throw new ApiError('invalid_request', 'request body is too large');
      },
    }),
    async (c) => {
      const started = Date.now();
      const client = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'direct';
      const wait = ipLimiter.take(client);
      if (wait > 0)
        throw new ApiError('rate_limited', 'too many captures, slow down', Math.ceil(wait / 1000));

      const body = CaptureRequest.safeParse(await c.req.json().catch(() => null));
      if (!body.success) throw new ApiError('invalid_request', 'expected {"envelope": "<base64>"}');

      const { signed } = service.parse(body.data.envelope);
      const signerWait = signerLimiter.take(signed.manifest.signer.key);
      if (signerWait > 0) {
        throw new ApiError(
          'rate_limited',
          'this device has sent too many captures',
          Math.ceil(signerWait / 1000),
        );
      }

      const receipt = await service.anchor(body.data.envelope);
      log({
        event: 'capture.anchored',
        contentHash: receipt.contentHash,
        block: receipt.blockNumber,
        ms: Date.now() - started,
      });
      return c.json(receipt, 201);
    },
  );

  app.notFound(() => {
    throw new ApiError('not_found', 'no such route');
  });

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      if (error.retryAfterSeconds) c.header('retry-after', String(error.retryAfterSeconds));
      if (error.status >= 500)
        log({ event: 'request.failed', code: error.code, message: error.message });
      return c.json({ error: { code: error.code, message: error.message } }, error.status as 400);
    }
    log({
      event: 'request.crashed',
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: { code: 'internal', message: 'internal error' } }, 500);
  });

  return app;
}
