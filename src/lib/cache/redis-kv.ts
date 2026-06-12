/** 可选 Redis 键值缓存（微信 token 等多实例共享） */

export async function redisGet(key: string): Promise<string | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;
  try {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    const v = await redis.get(key);
    await redis.quit();
    return v;
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return;
  try {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.set(key, value, "EX", ttlSeconds);
    await redis.quit();
  } catch {
    /* ignore */
  }
}
