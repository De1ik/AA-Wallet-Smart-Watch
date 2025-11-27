export interface HttpResult {
  status: number;
  body: any;
}

export const badRequest = (message: string): HttpResult => ({
  status: 400,
  body: { error: message },
});

export const ok = (body: any): HttpResult => ({
  status: 200,
  body,
});

export const rateLimit = (msg: string): HttpResult => ({
  status: 429,
  body: {
    error: "Rate limit exceeded",
    message: msg,
    retryAfter: 5,
  },
});

export const internalError = (msg: string, err: any): HttpResult => ({
  status: 500,
  body: { error: msg, details: err?.message },
});