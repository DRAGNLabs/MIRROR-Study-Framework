import pg from "pg";
import dotenv from 'dotenv';
dotenv.config();

// const AWS = require('aws-sdk');
// AWS.config.update({ region: 'us-east-1' });
// I had to add this for it to work on my mac (homebrew requires ssl to be set to false since it doesn't support SSL connections, if you get that error just add NODE_ENV=local to .env file)
const isLocal = process.env.PGHOST === "localhost";
const { Pool } = pg;

const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: isLocal ? false : { rejectUnathorized: false }
});

export default pool;

