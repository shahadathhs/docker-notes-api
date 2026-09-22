import express from "express";
import { Pool } from "pg";

const app = express();
app.use(express.json());

const port = Number(process.env.PORT) || 3000;

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "notes",
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/notes", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, created_at FROM notes ORDER BY id"
  );
  res.json(rows);
});

app.post("/notes", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const { rows } = await pool.query(
    "INSERT INTO notes (title) VALUES ($1) RETURNING id, title, created_at",
    [title]
  );
  res.status(201).json(rows[0]);
});

init()
  .then(() => {
    app.listen(port, () => {
      console.log(`notes-api listening on port ${port}`);
      console.log(`connected to postgres at ${process.env.PGHOST || "localhost"}:${process.env.PGPORT || 5432}`);
    });
  })
  .catch((err) => {
    console.error("failed to start:", err.message);
    process.exit(1);
  });
