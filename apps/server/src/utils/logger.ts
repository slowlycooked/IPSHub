import pino from 'pino';

export function createLogger(name: string) {
  return pino({
    level: process.env.LOG_LEVEL || 'debug',
  }).child({ module: name });
}

export const logger = createLogger('app');
