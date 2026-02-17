import Redis from "ioredis";

declare global {
  var redisClient: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    keepAlive: 10000,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  client.on("error", (err: Error) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected to", REDIS_URL);
  });

  client.on("ready", () => {
    console.log("[Redis] Ready");
  });

  client.on("close", () => {
    console.log("[Redis] Connection closed");
  });

  client.on("reconnecting", () => {
    console.log("[Redis] Reconnecting...");
  });

  return client;
}

export function getRedisClient(): Redis {
  if (typeof window !== "undefined") {
    throw new Error("Redis client cannot be used in browser");
  }

  if (!globalThis.redisClient) {
    globalThis.redisClient = createRedisClient();
  }

  return globalThis.redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (globalThis.redisClient) {
    await globalThis.redisClient.quit();
    globalThis.redisClient = undefined;
  }
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

export function getRedisConnectionOptions() {
  return {
    host: REDIS_URL.includes("@")
      ? REDIS_URL.split("@")[1].split(":")[0]
      : "localhost",
    port: REDIS_URL.includes("@")
      ? parseInt(REDIS_URL.split(":").pop() || "6379")
      : parseInt(REDIS_URL.split(":").pop() || "6379"),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function getRedisUrl(): string {
  return REDIS_URL;
}
