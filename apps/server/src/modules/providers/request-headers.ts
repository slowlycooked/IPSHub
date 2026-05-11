import { createLogger } from '../../utils/logger';

const logger = createLogger('provider-request-headers');

export function parseRequestHeaders(rawHeaders: string | null): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawHeaders) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== null && entry[1] !== undefined)
        .map(([key, value]) => [key, String(value)])
    );
  } catch (error) {
    logger.warn({ error, rawHeaders }, 'Invalid provider request headers JSON, ignoring headers');
    return undefined;
  }
}