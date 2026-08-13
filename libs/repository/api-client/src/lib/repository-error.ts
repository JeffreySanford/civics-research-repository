import type { components } from '../generated/repository-api.types';

export type ErrorResponse = components['schemas']['ErrorResponse'];

/** Serializable API error shape for NgRx actions and UI notifications. */
export interface RepositoryError {
  readonly code: string;
  readonly message: string;
  readonly details?: readonly string[];
  readonly traceId?: string;
}

interface HttpErrorLike {
  readonly status?: number;
  readonly error?: unknown;
  readonly headers?: { get(name: string): string | null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return isRecord(error) && 'status' in error;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string'
  );
}

function readTraceHeader(error: HttpErrorLike): string | undefined {
  const traceId = error.headers?.get('X-Trace-Id');
  return traceId && traceId.length > 0 ? traceId : undefined;
}

function httpStatusToCode(status: number | undefined): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 404:
      return 'NOT_FOUND';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status !== undefined && status >= 500
        ? 'INTERNAL_ERROR'
        : 'UNKNOWN';
  }
}

/**
 * Normalizes Angular HttpClient failures and plain Errors into the OpenAPI ErrorResponse shape.
 */
export function parseRepositoryError(
  error: unknown,
  fallbackMessage: string,
): RepositoryError {
  if (isHttpErrorLike(error)) {
    const body = error.error;
    if (isErrorResponse(body)) {
      return {
        code: body.code,
        message: body.message,
        details: body.details,
        traceId: body.traceId ?? readTraceHeader(error),
      };
    }

    return {
      code: httpStatusToCode(error.status),
      message: fallbackMessage,
      traceId: readTraceHeader(error),
    };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return { code: 'UNKNOWN', message: error.message };
  }

  return { code: 'UNKNOWN', message: fallbackMessage };
}

export function repositoryErrorMessage(error: RepositoryError): string {
  return error.message;
}
