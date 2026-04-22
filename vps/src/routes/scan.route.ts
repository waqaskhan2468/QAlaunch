import { Router } from 'express';
import { runScan } from '../controllers/scan.controller';
import { verifyToken } from '../utils/auth';

const router = Router();

router.post('/', verifyToken, runScan);

export default router;
