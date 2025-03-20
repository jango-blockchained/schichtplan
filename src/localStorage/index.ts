import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializeDatabase } from './utils/storage';
import employeeRoutes from './routes/employeeRoutes';
import settingsRoutes from './routes/settingsRoutes';

// Initialize the database
initializeDatabase();

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
}));

// API Health check
app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        backend: 'localStorage',
    });
});

// Register routes
app.route('/api/employees', employeeRoutes);
app.route('/api/settings', settingsRoutes);

// Error handler
app.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({
        error: err.message || 'An unexpected error occurred',
        message: 'An unexpected error occurred. Please try again later.',
    }, 500);
});

// Set up port
const port = parseInt(process.env.PORT || '5000');

console.log(`Starting localStorage backend on port ${port}...`);
console.log('Data stored in ./data directory');

export default {
    port,
    fetch: app.fetch,
};