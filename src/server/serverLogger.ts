/**
 * @module serverLogger
 * @description
 * Lightweight structured logger for the Express LAN host (`server.ts`).
 * Suppresses verbose informational logs during Vitest runs while preserving
 * explicit error visibility in production and development runtimes.
 */

const isTestEnv = (): boolean => Boolean(process.env.VITEST);

const formatPrefix = (level: 'INFO' | 'WARN' | 'ERROR'): string => {
  return `[${new Date().toISOString()}][${level}]`;
};

export const serverLogger = {
  info(message: string, ...args: unknown[]): void {
    if (isTestEnv()) return;
    console.log(`${formatPrefix('INFO')} ${message}`, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    if (isTestEnv()) return;
    console.warn(`${formatPrefix('WARN')} ${message}`, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    if (isTestEnv()) return;
    console.error(`${formatPrefix('ERROR')} ${message}`, ...args);
  },
};
