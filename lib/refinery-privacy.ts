export function scrubIpAddresses(data: unknown): unknown {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const order = data as Record<string, unknown>;
    if ('upstream_address' in order) order.upstream_address = null;
    if (Array.isArray(order.sessions)) {
      for (const session of order.sessions) {
        if (session && typeof session === 'object') {
          (session as Record<string, unknown>).remote_address = null;
        }
      }
    }
  }
  return data;
}
