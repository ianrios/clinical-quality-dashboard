import app from './app';
import { pool } from './db';

const PORT = process.env.PORT || 3000;

app().then((express) => {
  const httpServer = express.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      pool.end(() => process.exit(0));
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
