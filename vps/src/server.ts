import express from 'express';
import dotenv from 'dotenv';
import scanRoutes from './routes/scan.route';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));

app.use('/scan', scanRoutes);

export default app;
