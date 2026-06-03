import { Router } from 'express';
import qualityRoutes from './quality.routes';
import studiesRoutes from './studies.routes';

const router = Router();

router.use('/quality', qualityRoutes);
router.use('/studies', studiesRoutes);

export default router;
