export interface HttpResult<T> {
  status: number;
  body: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export const badRequest = (message: string, details?: string): HttpResult<ErrorResponse> => ({
  status: 400,
  body: { success: false, error: message, details: details },
});

export const ok = (body: any): HttpResult<any> => ({
  status: 200,
  body,
});

export const rateLimit = (msg: string): HttpResult<{ error: string; message: string; retryAfter: number }> => ({
  status: 429,
  body: {
    error: "Rate limit exceeded",
    message: msg,
    retryAfter: 5,
  },
});

export const internalError = (msg: string, err: any): HttpResult<ErrorResponse> => ({
  status: 500,
  body: { success: false, error: msg, details: err?.message },
});
