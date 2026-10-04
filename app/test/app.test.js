// Testes de integração. Requerem um PostgreSQL acessível via DATABASE_URL, por exemplo:
//   DATABASE_URL=postgres://wm:wm@localhost:5432/wmcloud npm test
const test = require('node:test');
const assert = require('node:assert');
const { pool, migrate } = require('../src/db');
const app = require('../src/server');

let server, base;
const post = (path, body) => fetch(base + path, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body),
});

test.before(async () => {
  await migrate();
  await pool.query('TRUNCATE movements, products, categories, suppliers RESTART IDENTITY CASCADE');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.close(); await pool.end(); });

test('health check responde 200', async () => {
  assert.strictEqual((await fetch(base + '/health')).status, 200);
  assert.strictEqual((await fetch(base + '/health/db')).status, 200);
});

test('cadastro, entrada, saída e saldo', async () => {
  let res = await post('/products', { sku: 'T-1', name: 'Teste', min_stock: '5', stock: '10' });
  assert.strictEqual(res.status, 302);
  res = await post('/movements', { type: 'out', product_id: '1', quantity: '4', note: 'venda' });
  assert.strictEqual(res.status, 302);
  res = await post('/movements', { type: 'in', product_id: '1', quantity: '2' });
  assert.strictEqual(res.status, 302);
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = 1');
  assert.strictEqual(rows[0].stock, 8);
  const hist = await pool.query('SELECT count(*)::int AS n FROM movements WHERE product_id = 1');
  assert.strictEqual(hist.rows[0].n, 3); // estoque inicial + saída + entrada
});

test('saída maior que o saldo é recusada e não altera o estoque', async () => {
  const res = await post('/movements', { type: 'out', product_id: '1', quantity: '999' });
  assert.strictEqual(res.status, 422);
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = 1');
  assert.strictEqual(rows[0].stock, 8);
});

test('saídas concorrentes nunca deixam o estoque negativo', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => post('/movements', { type: 'out', product_id: '1', quantity: '3' })));
  const okCount = results.filter((r) => r.status === 302).length;
  assert.strictEqual(okCount, 2); // saldo 8 -> só 2 saídas de 3 cabem
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = 1');
  assert.strictEqual(rows[0].stock, 2);
});

test('alerta de estoque baixo aparece na tela', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /abaixo do mínimo/);
  assert.match(html, /Estoque baixo/);
});

test('SKU duplicado é rejeitado', async () => {
  const res = await post('/products', { sku: 'T-1', name: 'Outro', min_stock: '0', stock: '0' });
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /SKU já cadastrado/);
});

test('importação CSV cria produtos, categorias e estoque inicial', async () => {
  const fs = require('fs');
  const csv = fs.readFileSync(require('path').join(__dirname, '..', 'sample', 'produtos_exemplo.csv'));
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'p.csv');
  const res = await fetch(base + '/import', { method: 'POST', body: form });
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /5 produto\(s\) criado\(s\)/);
  const { rows } = await pool.query("SELECT stock FROM products WHERE sku = 'ARZ-001'");
  assert.strictEqual(rows[0].stock, 120);
  // reimportar não duplica nem relança estoque
  const form2 = new FormData();
  form2.append('file', new Blob([csv], { type: 'text/csv' }), 'p.csv');
  assert.match(await (await fetch(base + '/import', { method: 'POST', body: form2 })).text(), /0 produto\(s\) criado\(s\), 5 atualizado/);
  const again = await pool.query("SELECT stock FROM products WHERE sku = 'ARZ-001'");
  assert.strictEqual(again.rows[0].stock, 120);
});
