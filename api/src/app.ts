import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import router from './routes';

export default async (): Promise<Express> => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.use('/api', router);

  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return app;
};
