export type NotaryErrorCode =
  | 'invalid_request'
  | 'invalid_envelope'
  | 'bad_signature'
  | 'wrong_network'
  | 'unknown_block'
  | 'stale_block'
  | 'already_anchored'
  | 'rate_limited'
  | 'not_configured'
  | 'submission_failed'
  | 'unavailable'
  | 'not_found'
  | 'internal';

const STATUS: Record<NotaryErrorCode, number> = {
  invalid_request: 400,
  invalid_envelope: 422,
  bad_signature: 422,
  wrong_network: 422,
  unknown_block: 422,
  stale_block: 422,
  already_anchored: 409,
  rate_limited: 429,
  not_configured: 503,
  submission_failed: 502,
  unavailable: 503,
  not_found: 404,
  internal: 500,
};

/** An error that is safe to show to API clients. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;

  constructor(
    readonly code: NotaryErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
