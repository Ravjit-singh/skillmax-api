const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- AUTHENTICATION ROUTES ---

app.post('/api/login', async (req, res) => {
    const { userId, password } = req.body;
    try {
        const result = await db.query(`SELECT * FROM users WHERE user_id = $1 AND password = $2`, [userId, password]);
        if (result.rows.length > 0) {
            res.json({ message: 'Login successful', userId: result.rows[0].user_id });
        } else {
            res.status(401).json({ message: 'Invalid ID or Password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/signup', async (req, res) => {
    const { userId, password } = req.body;
    try {
        await db.query(`INSERT INTO users (user_id, password) VALUES ($1, $2)`, [userId, password]);
        res.json({ message: 'Account created!', userId: userId });
    } catch (err) {
        // '23505' is the PostgreSQL error code for a Unique Constraint Violation (User ID already exists)
        if (err.code === '23505') {
            return res.status(400).json({ message: 'User ID already exists!' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- PRIVATE SKILL ROUTES ---

app.get('/api/skills', async (req, res) => {
    const activeUser = req.headers['x-user-id'];
    if (!activeUser) return res.status(401).json({ message: "Unauthorized" });

    try {
        const skillsResult = await db.query(`SELECT * FROM skills WHERE user_id = $1`, [activeUser]);
        const logsResult = await db.query(`SELECT * FROM logs ORDER BY date DESC`);

        const formattedSkills = skillsResult.rows.map(skill => {
            return {
                id: skill.id,
                title: skill.title,
                category: skill.category,
                status: skill.status,
                createdAt: skill.createdat, // Postgres makes column names lowercase
                logs: logsResult.rows
                    .filter(log => log.skill_id === skill.id)
                    .map(l => ({
                        id: l.id,
                        text: l.text,
                        isSystem: l.is_system === 1,
                        date: l.date
                    }))
            };
        });
        res.json(formattedSkills);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/skills', async (req, res) => {
    const activeUser = req.headers['x-user-id'];
    if (!activeUser) return res.status(401).json({ message: "Unauthorized" });

    const { title, category } = req.body;
    const createdAt = new Date().toISOString();
    const status = 'backlog';

    try {
        // 'RETURNING id' tells Postgres to give us the ID of the newly created row instantly
        const result = await db.query(
            `INSERT INTO skills (user_id, title, category, status, createdAt) VALUES ($1, $2, $3, $4, $5) RETURNING id`, 
            [activeUser, title, category, status, createdAt]
        );
        res.json({ id: result.rows[0].id, title, category, status, createdAt, logs: [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/skills/:id/logs', async (req, res) => {
    const skillId = req.params.id;
    const { text, isSystem } = req.body;
    const date = new Date().toISOString();
    const systemFlag = isSystem ? 1 : 0;

    try {
        const result = await db.query(
            `INSERT INTO logs (skill_id, text, is_system, date) VALUES ($1, $2, $3, $4) RETURNING id`, 
            [skillId, text, systemFlag, date]
        );
        res.json({ id: result.rows[0].id, text, isSystem: isSystem, date });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/skills/:id/status', async (req, res) => {
    const skillId = req.params.id;
    const { status } = req.body;
    const logText = `Moved to ${status.toUpperCase()}`;
    const date = new Date().toISOString();

    try {
        await db.query(`UPDATE skills SET status = $1 WHERE id = $2`, [status, skillId]);
        const logResult = await db.query(
            `INSERT INTO logs (skill_id, text, is_system, date) VALUES ($1, $2, 1, $3) RETURNING id`, 
            [skillId, logText, date]
        );
        res.json({ 
            message: "Status updated", 
            autoLog: { id: logResult.rows[0].id, text: logText, isSystem: true, date }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/skills/:id', async (req, res) => {
    try {
        await db.query(`DELETE FROM skills WHERE id = $1`, [req.params.id]);
        res.json({ message: "Skill deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// --- KEEP-ALIVE PING ROUTE ---
app.get('/api/ping', (req, res) => {
    res.status(200).json({ message: 'Render is awake! Database is sleeping.' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SkillMAX Server is running!`);
    console.log(`☁️  Data is syncing to Neon PostgreSQL.`);
});
