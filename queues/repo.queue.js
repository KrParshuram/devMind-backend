import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}  // required for Upstash SSL
};

const RepoIndexing = new Queue('GithubRepo', { connection });

export default RepoIndexing;