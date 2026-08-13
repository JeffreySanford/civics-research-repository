import { describe, expect, it } from 'vitest';
import { parseRepositoryError } from './repository-error';

describe('parseRepositoryError', () => {
  it('parses typed ErrorResponse bodies from HTTP failures', () => {
    const parsed = parseRepositoryError(
      {
        status: 503,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'DSpace is unavailable.',
          traceId: 'trace-123',
        },
        headers: { get: () => null },
      },
      'Fallback',
    );

    expect(parsed).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'DSpace is unavailable.',
      traceId: 'trace-123',
    });
  });

  it('maps HTTP status to stable codes when the body is not typed', () => {
    const parsed = parseRepositoryError(
      {
        status: 404,
        error: '<html>not found</html>',
        headers: { get: () => 'header-trace' },
      },
      'Dataset not found.',
    );

    expect(parsed).toEqual({
      code: 'NOT_FOUND',
      message: 'Dataset not found.',
      traceId: 'header-trace',
    });
  });

  it('falls back to Error.message for non-HTTP failures', () => {
    expect(
      parseRepositoryError(new Error('Gateway timeout'), 'Search failed.'),
    ).toEqual({
      code: 'UNKNOWN',
      message: 'Gateway timeout',
    });
  });

  it('uses the fallback message for unknown failures', () => {
    expect(parseRepositoryError({ status: 500 }, 'Search failed.')).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Search failed.',
    });
  });
});
