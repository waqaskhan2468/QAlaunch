import { Router } from 'express';
import { runScan } from '../controllers/scan.controller';
import { requireBearerToken } from '../utils/auth';

const router = Router();

router.post('/', requireBearerToken, runScan);

export default router;
