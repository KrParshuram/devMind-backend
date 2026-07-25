import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}  // required for Upstash SSL
};

const Resourcequeue = new Queue('Resources', { connection });

export default Resourcequeue;