import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import db from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/templates', express.static(path.join(__dirname, 'public', 'templates')));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/test-db', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      message: 'Database connection successful',
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: err.message 
    });
  }
});

// API Routes
import templatesRouter from './routes/templates';
import vouchersRouter from './routes/vouchers';
import ordersRouter from './routes/orders';
import qrcodesRouter from './routes/qrcodes';

app.use('/api/templates', templatesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/qrcodes', qrcodesRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

