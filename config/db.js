const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const host = process.env.DB_HOST || 'localhost';
const isLocal = host === 'localhost' || host === '127.0.0.1';

const pool = new Pool({
  host,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};