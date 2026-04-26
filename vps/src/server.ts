import express from 'express';
import morgan from 'morgan';
import scanRoutes from './routes/scan.route';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// HTTP request logger
if (process.env.NODE_ENV === 'production') {
	app.use(morgan('combined'));
} else {
	app.use(morgan('dev'));
}

app.use(express.json());


app.get('/health', (_req, res) => {
	res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use('/scan', scanRoutes);
// global error handler must be last
app.use(errorMiddleware);
export default app;
