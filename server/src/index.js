import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import convertRouter from './routes/convert.js';
import validateRouter from './routes/validate.js';
import healthRouter from './routes/health.js';
import { initBrowser } from './utils/puppeteerPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for output
const outputDir = path.join(__dirname, '..', 'output');
app.use('/output', express.static(outputDir));

// Routes
app.use('/api', healthRouter);
app.use('/api', convertRouter);
app.use('/api', validateRouter);

// Initialize Puppeteer and start server
async function start() {
    try {
        console.log('🚀 Initializing Puppeteer browser...');
        await initBrowser();
        console.log('✅ Puppeteer browser ready');

        app.listen(PORT, () => {
            console.log(`✅ Server running at http://localhost:${PORT}`);
            console.log(`📁 Output directory: ${outputDir}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();
