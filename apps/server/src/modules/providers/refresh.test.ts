import { describe, expect, it } from 'vitest';
import { parseRequestHeaders } from './request-headers';

describe('parseRequestHeaders', () => {
  it('returns normalized string headers from valid JSON', () => {
    expect(parseRequestHeaders('{"x-token":"abc","retry":2,"debug":true}')).toEqual({
      'x-token': 'abc',
      retry: '2',
      debug: 'true',
    });
  });

  it('returns undefined for empty or invalid header input', () => {
    expect(parseRequestHeaders(null)).toBeUndefined();
    expect(parseRequestHeaders('')).toBeUndefined();
    expect(parseRequestHeaders('{not-json}')).toBeUndefined();
  });
});