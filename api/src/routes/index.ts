import { Router } from 'express';
import qualityRoutes from './quality.routes';
import studiesRoutes from './studies.routes';
import participantsRoutes from './participants.routes';

const router = Router();

router.use('/quality', qualityRoutes);
router.use('/studies', studiesRoutes);
router.use('/participants', participantsRoutes);

export default router;
