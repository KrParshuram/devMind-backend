import client from "./config/redis.js";

// Use the specific Redis methods instead
async function testRedis() {
  // To save data
  await client.set("myKey", "Hello Redis!");

  // To fetch data
  const value = await client.get("myKey");
  console.log(value); // Outputs: Hello Redis!
}

testRedis();