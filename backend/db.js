import pg from "pg";
import dotenv from 'dotenv';
dotenv.config();

// const AWS = require('aws-sdk');
// AWS.config.update({ region: 'us-east-1' });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false, 
        //ca: require('fs').readFileSync('/certs/global-bundle.pem').toString() 
        }
});

export default pool;

