import { createClient } from "redis";

const redis = createClient({
  url: 'redis://default:uwkZq1jfU46cpDkt99OqHxr4i1stkxLb@redis-14826.c270.us-east-1-3.ec2.cloud.redislabs.com:14826',
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error", err);
});

await redis.connect();
await redis.flushDb(); 

export default redis;
