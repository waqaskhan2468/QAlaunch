import { Router } from 'express';
import { createReportPdf } from '../controllers/report.controller';
import { requireBearerToken } from '../utils/auth';

const router = Router();

router.post('/pdf', requireBearerToken, createReportPdf);

export default router;
