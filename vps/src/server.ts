import express from 'express';
import morgan from 'morgan';
import scanRoutes from './routes/scan.route';

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

export default app;
