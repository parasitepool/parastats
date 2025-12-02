import { 
  fetch as http2Fetch, 
  TimeoutError, 
  isTimeoutError,
  type ExtendedRequestInit 
} from '@/lib/http-client';

/**
 * Fetch with automatic timeout to prevent hanging requests
 * 
 * Uses the HTTP/2 enabled client from lib/http-client for better performance
 * with connection pooling and multiplexing support.
 * 
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to the Response
 * @throws TimeoutError if the request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const { signal: userSignal, ...restOptions } = options;

  const init: ExtendedRequestInit = {
    ...restOptions,
    timeout: timeoutMs,
    throwOnTimeout: true,
  };

  // Forward user's signal if provided
  if (userSignal) {
    init.signal = userSignal;
  }

  return http2Fetch(url, init);
}

// Re-export useful utilities for consumers
export { TimeoutError, isTimeoutError };

