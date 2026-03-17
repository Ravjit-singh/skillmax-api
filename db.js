const { Pool } = require('pg');
require('dotenv').config(); // This loads your secret string from the .env file

// Connect to Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});

const initDb = async () => {
    try {
        // 1. Users Table
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            user_id TEXT UNIQUE,
            password TEXT
        )`);

        // 2. Skills Table
        await pool.query(`CREATE TABLE IF NOT EXISTS skills (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            title TEXT,
            category TEXT,
            status TEXT,
            createdAt TEXT,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )`);

        // 3. Logs Table
        await pool.query(`CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            skill_id INTEGER,
            text TEXT,
            is_system INTEGER,
            date TEXT,
            FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
        )`);

        console.log('☁️ Connected to Neon PostgreSQL database.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();

// Export the query tool so server.js can use it
module.exports = {
    query: (text, params) => pool.query(text, params),
};
