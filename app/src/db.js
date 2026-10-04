const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuração por variáveis de ambiente (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
// ou DATABASE_URL. PGSSL=true habilita TLS (usado com o RDS).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PGPOOL_MAX || 10),
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Lock consultivo: evita corrida quando várias instâncias sobem juntas.
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
}

// Registra uma movimentação de forma transacional, sem permitir estoque negativo.
async function addMovement(client, { productId, type, quantity, note }) {
  const delta = type === 'in' ? quantity : -quantity;
  const { rows } = await client.query(
    `UPDATE products SET stock = stock + $1
      WHERE id = $2 AND stock + $1 >= 0
      RETURNING id, stock`,
    [delta, productId]
  );
  if (rows.length === 0) {
    const exists = await client.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (exists.rows.length === 0) throw new HttpError(404, 'Produto não encontrado.');
    throw new HttpError(422, `Estoque insuficiente: saldo atual ${exists.rows[0].stock}, saída solicitada ${quantity}.`);
  }
  await client.query(
    'INSERT INTO movements (product_id, type, quantity, note) VALUES ($1, $2, $3, $4)',
    [productId, type, quantity, note || null]
  );
  return rows[0].stock;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

module.exports = { pool, migrate, addMovement, withTransaction, HttpError };
