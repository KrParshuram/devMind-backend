import Redis from "ioredis";

const client = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}  // required for Upstash
});

client.on("connect", () => console.log("Redis connected"));
client.on("error", (err) => console.error("Redis error:", err));

export default client;