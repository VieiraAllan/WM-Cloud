const path = require('path');
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { pool, migrate, addMovement, withTransaction, HttpError } = require('./db');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check do ALB: leve, sem consultar o banco (uma falha do RDS não deve
// derrubar todas as instâncias). /health/db verifica também o banco.
app.get('/health', (req, res) => res.status(200).send('ok'));
app.get('/health/db', async (req, res) => {
  try { await pool.query('SELECT 1'); res.send('ok'); } catch { res.status(503).send('db indisponível'); }
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const int = (v) => (v === '' || v == null ? null : Number.parseInt(v, 10));
const render = (res, view, data = {}) => res.render(view, { error: null, ok: null, ...data });

// ---------- Estoque atual ----------
app.get('/', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  const low = req.query.low === '1';
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category, s.name AS supplier
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers  s ON s.id = p.supplier_id
      WHERE ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR p.sku ILIKE '%' || $1 || '%')
        AND (NOT $2 OR p.stock <= p.min_stock)
      ORDER BY (p.stock <= p.min_stock) DESC, p.name`,
    [q, low]
  );
  const alerts = await pool.query('SELECT count(*)::int AS n FROM products WHERE stock <= min_stock');
  render(res, 'index', { products: rows, q, low, alertCount: alerts.rows[0].n, page: 'stock' });
}));

// ---------- Produtos ----------
async function formLists() {
  const [c, s] = await Promise.all([
    pool.query('SELECT * FROM categories ORDER BY name'),
    pool.query('SELECT * FROM suppliers ORDER BY name'),
  ]);
  return { categories: c.rows, suppliers: s.rows };
}

app.get('/products/new', wrap(async (req, res) =>
  render(res, 'product_form', { product: {}, ...(await formLists()), page: 'products' })));

app.post('/products', wrap(async (req, res) => {
  const b = req.body;
  try {
    await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO products (sku, name, category_id, supplier_id, min_stock)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [b.sku.trim(), b.name.trim(), int(b.category_id), int(b.supplier_id), int(b.min_stock) || 0]
      );
      const initial = int(b.stock) || 0;
      if (initial > 0) await addMovement(c, { productId: rows[0].id, type: 'in', quantity: initial, note: 'Estoque inicial' });
    });
    res.redirect('/');
  } catch (err) {
    if (err.code === '23505') {
      return render(res, 'product_form', { product: b, ...(await formLists()), error: 'SKU já cadastrado.', page: 'products' });
    }
    throw err;
  }
}));

app.get('/products/:id/edit', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows.length) throw new HttpError(404, 'Produto não encontrado.');
  render(res, 'product_form', { product: rows[0], ...(await formLists()), page: 'products' });
}));

app.post('/products/:id', wrap(async (req, res) => {
  const b = req.body;
  try {
    await pool.query(
      `UPDATE products SET sku=$1, name=$2, category_id=$3, supplier_id=$4, min_stock=$5 WHERE id=$6`,
      [b.sku.trim(), b.name.trim(), int(b.category_id), int(b.supplier_id), int(b.min_stock) || 0, req.params.id]
    );
    res.redirect('/');
  } catch (err) {
    if (err.code === '23505') {
      return render(res, 'product_form', { product: { ...b, id: req.params.id }, ...(await formLists()), error: 'SKU já cadastrado.', page: 'products' });
    }
    throw err;
  }
}));

app.post('/products/:id/delete', wrap(async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.redirect('/');
  } catch (err) {
    if (err.code === '23503') throw new HttpError(409, 'Produto com movimentações não pode ser excluído.');
    throw err;
  }
}));

// ---------- Categorias e fornecedores ----------
function simpleCrud(table, view, page, fields) {
  app.get(`/${table}`, wrap(async (req, res) => {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY name`);
    render(res, view, { rows, page });
  }));
  app.post(`/${table}`, wrap(async (req, res) => {
    const vals = fields.map((f) => (req.body[f] || '').trim() || null);
    try {
      await pool.query(
        `INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(',')})`, vals);
      res.redirect(`/${table}`);
    } catch (err) {
      if (err.code !== '23505') throw err;
      const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY name`);
      render(res, view, { rows, page, error: 'Já existe um registro com esse nome.' });
    }
  }));
  app.post(`/${table}/:id/delete`, wrap(async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.redirect(`/${table}`);
  }));
}
simpleCrud('categories', 'categories', 'categories', ['name']);
simpleCrud('suppliers', 'suppliers', 'suppliers', ['name', 'email', 'phone']);

// ---------- Movimentações ----------
app.get('/movements', wrap(async (req, res) => {
  const type = ['in', 'out'].includes(req.query.type) ? req.query.type : '';
  const product = int(req.query.product);
  const { rows } = await pool.query(
    `SELECT m.*, p.sku, p.name AS product
       FROM movements m JOIN products p ON p.id = m.product_id
      WHERE ($1 = '' OR m.type = $1) AND ($2::int IS NULL OR m.product_id = $2)
      ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
    [type, product]
  );
  const products = await pool.query('SELECT id, sku, name FROM products ORDER BY name');
  render(res, 'movements', { rows, type, product, products: products.rows, page: 'movements' });
}));

app.get('/movements/new', wrap(async (req, res) => {
  const products = await pool.query('SELECT id, sku, name, stock FROM products ORDER BY name');
  render(res, 'movement_form', { products: products.rows, form: { type: req.query.type === 'out' ? 'out' : 'in', product_id: req.query.product || '' }, page: 'movements' });
}));

app.post('/movements', wrap(async (req, res) => {
  const b = req.body;
  const quantity = int(b.quantity);
  try {
    if (!['in', 'out'].includes(b.type)) throw new HttpError(422, 'Tipo inválido.');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(422, 'Informe uma quantidade maior que zero.');
    await withTransaction((c) => addMovement(c, { productId: int(b.product_id), type: b.type, quantity, note: (b.note || '').trim() }));
    res.redirect('/movements');
  } catch (err) {
    if (!(err instanceof HttpError)) throw err;
    const products = await pool.query('SELECT id, sku, name, stock FROM products ORDER BY name');
    res.status(err.status);
    render(res, 'movement_form', { products: products.rows, form: b, error: err.message, page: 'movements' });
  }
}));

// ---------- Importação CSV (migração das planilhas) ----------
app.get('/import', (req, res) => render(res, 'import', { page: 'import', result: null }));

app.post('/import', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return render(res, 'import', { page: 'import', result: null, error: 'Selecione um arquivo CSV.' });
  let records;
  try {
    const text = req.file.buffer.toString('utf8').replace(/^﻿/, '');
    const delimiter = text.split('\n')[0].includes(';') ? ';' : ',';
    records = parse(text, { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, delimiter });
  } catch {
    return render(res, 'import', { page: 'import', result: null, error: 'CSV inválido.' });
  }
  const result = { created: 0, updated: 0, errors: [] };
  await withTransaction(async (c) => {
    for (const [i, r] of records.entries()) {
      const line = i + 2;
      if (!r.sku || !r.name) { result.errors.push(`Linha ${line}: sku e name são obrigatórios.`); continue; }
      const stock = Number.parseInt(r.stock || '0', 10);
      const min = Number.parseInt(r.min_stock || '0', 10);
      if (!(stock >= 0) || !(min >= 0)) { result.errors.push(`Linha ${line}: stock/min_stock inválidos.`); continue; }
      let catId = null, supId = null;
      if (r.category) catId = (await c.query(
        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [r.category])).rows[0].id;
      if (r.supplier) supId = (await c.query(
        'INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [r.supplier])).rows[0].id;
      const found = await c.query('SELECT id FROM products WHERE sku = $1', [r.sku]);
      if (found.rows.length) {
        await c.query('UPDATE products SET name=$1, category_id=$2, supplier_id=$3, min_stock=$4 WHERE id=$5',
          [r.name, catId, supId, min, found.rows[0].id]);
        result.updated++;
      } else {
        const ins = await c.query(
          'INSERT INTO products (sku, name, category_id, supplier_id, min_stock) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [r.sku, r.name, catId, supId, min]);
        if (stock > 0) await addMovement(c, { productId: ins.rows[0].id, type: 'in', quantity: stock, note: 'Importação inicial' });
        result.created++;
      }
    }
  });
  render(res, 'import', { page: 'import', result });
}));

// ---------- Erros ----------
app.use((req, res) => res.status(404).render('error', { status: 404, message: 'Página não encontrada.', page: '' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).render('error', { status, message: status === 500 ? 'Erro interno do servidor.' : err.message, page: '' });
});

module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  migrate()
    .then(() => app.listen(port, '0.0.0.0', () => console.log(`WM Cloud ouvindo na porta ${port}`)))
    .catch((err) => { console.error('Falha ao iniciar:', err.message); process.exit(1); });
}
