import { Pool } from 'pg';

// Configure the database driver instance pooled connection setup
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'availability_app', // Database name
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Iam4jesus',  
});

// Export a clean, unified query handler function
export const query = (text: string, params?: any[]) => pool.query(text, params);