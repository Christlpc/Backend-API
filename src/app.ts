import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Root Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to Afrigo Backend API' });
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Serve Documentation
const docsPath = path.join(__dirname, '..', 'documentation', 'build');
app.use('/docs', express.static(docsPath, {
    index: 'index.html',
    extensions: ['html']
}));

// SPA fallback for documentation - serve index.html for all /docs routes
app.get('/docs/*', (req, res) => {
    res.sendFile(path.join(docsPath, 'index.html'));
});

// Error Handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
