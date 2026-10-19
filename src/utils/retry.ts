import { Logger } from '../core/logger/LoggerService';

export interface RetryOptions {
  retries?: number;
  delay?: number;
  backoff?: number;
  onRetry?: (error: any, attempt: number) => void;
}

/**
 * Executes an async operation with exponential backoff retry logic
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    delay = 500,
    backoff = 2,
    onRetry = (error, attempt) => {
      Logger.warn(`Retry attempt ${attempt} failed: ${error?.message || error}`, 'retry');
    },
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      onRetry(error, attempt);

      if (attempt < retries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}
