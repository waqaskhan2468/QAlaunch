import dotenv from 'dotenv';
dotenv.config({ path: 'src/.env' });
import app from './server';
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`🚀 Playwright VPS running on port ${PORT}`);
});
