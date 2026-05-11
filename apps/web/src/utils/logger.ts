export function createLogger(name: string) {
  return {
    info: (msg: string, data?: any) => console.log(`[${name}]`, msg, data),
    warn: (msg: string, data?: any) => console.warn(`[${name}]`, msg, data),
    error: (msg: string, data?: any) => console.error(`[${name}]`, msg, data),
    debug: (msg: string, data?: any) => console.debug(`[${name}]`, msg, data),
  };
}
