const buckets = new Map();

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function allowRequest(req) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const max = Number(process.env.RATE_LIMIT_MAX || 30);
  const ip = getClientIp(req);
  const now = Date.now();
  const current = buckets.get(ip);

  if (!current || now >= current.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(max - 1, 0), resetAt: now + windowMs };
  }

  current.count += 1;
  if (current.count > max) return { allowed: false, remaining: 0, resetAt: current.resetAt };
  return { allowed: true, remaining: Math.max(max - current.count, 0), resetAt: current.resetAt };
}
