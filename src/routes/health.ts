export function healthCheck() {
  return {
    guild: 'creator',
    status: 'healthy',
    version: '0.1.0',
    nats_prefix: 'citadel.creator.*',
    timestamp: new Date().toISOString(),
  };
}
