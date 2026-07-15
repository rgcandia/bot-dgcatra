import { Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const mensajesQueue = new Queue('mensajes-whatsapp', { connection });

export function createWorker(processor: (job: any) => Promise<void>) {
  return new Worker('mensajes-whatsapp', async (job) => {
    await processor(job);
  }, { connection });
}
