// Testes de integração. Requerem um PostgreSQL acessível via DATABASE_URL, por exemplo:
//   DATABASE_URL=postgres://wm:wm@localhost:5432/wmcloud npm test
const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, createSession, readSession } = require('../src/auth');

// O login é obrigatório: configura um usuário de teste antes de carregar o servidor.
const SENHA = 'senha-de-teste';
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD_HASH = hashPassword(SENHA);
process.env.SESSION_SECRET = SEGREDO;

const { pool, migrate } = require('../src/db');
const app = require('../src/server');

let server, base, cookie;
const form = (body) => ({ 'Content-Type': 'application/x-www-form-urlencoded', body: new URLSearchParams(body) });
const get = (path) => fetch(base + path, { redirect: 'manual', headers: { Cookie: cookie } });
const post = (path, body) => fetch(base + path, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': form(body)['Content-Type'], Cookie: cookie },
  body: form(body).body,
});
const postAnon = (path, body) => fetch(base + path, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': form(body)['Content-Type'] },
  body: form(body).body,
});
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test.before(async () => {
  await migrate();
  await pool.query('TRUNCATE movements, products, categories, suppliers RESTART IDENTITY CASCADE');
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await postAnon('/login', { username: 'admin', password: SENHA });
  cookie = cookieFrom(res);
});
test.after(async () => { server.close(); await pool.end(); });

test('health check responde 200', async () => {
  assert.strictEqual((await fetch(base + '/health')).status, 200); // sem login
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
  const html = await (await get('/')).text();
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
  const f1 = new FormData();
  f1.append('file', new Blob([csv], { type: 'text/csv' }), 'p.csv');
  const res = await fetch(base + '/import', { method: 'POST', headers: { Cookie: cookie }, body: f1 });
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /5 produto\(s\) criado\(s\)/);
  const { rows } = await pool.query("SELECT stock FROM products WHERE sku = 'ARZ-001'");
  assert.strictEqual(rows[0].stock, 120);
  // reimportar não duplica nem relança estoque
  const f2 = new FormData();
  f2.append('file', new Blob([csv], { type: 'text/csv' }), 'p.csv');
  assert.match(await (await fetch(base + '/import', { method: 'POST', headers: { Cookie: cookie }, body: f2 })).text(), /0 produto\(s\) criado\(s\), 5 atualizado/);
  const again = await pool.query("SELECT stock FROM products WHERE sku = 'ARZ-001'");
  assert.strictEqual(again.rows[0].stock, 120);
});

// ---------- Edição de categorias e fornecedores ----------
const idOf = async (table, name) => (await pool.query(`SELECT id FROM ${table} WHERE name = $1`, [name])).rows[0].id;

test('categoria criada pode ser editada e o produto ligado acompanha o novo nome', async () => {
  await post('/categories', { name: 'Bebidas' });
  const id = await idOf('categories', 'Bebidas');
  await post('/products', { sku: 'CAT-1', name: 'Suco', category_id: String(id), min_stock: '0', stock: '0' });

  const page = await get(`/categories/${id}/edit`);
  assert.strictEqual(page.status, 200);
  assert.match(await page.text(), /value="Bebidas"/);

  const res = await post(`/categories/${id}`, { name: 'Bebidas geladas' });
  assert.strictEqual(res.status, 302);
  assert.match(await (await get('/')).text(), /Bebidas geladas/); // produto continua ligado, com o novo nome
  assert.strictEqual((await pool.query("SELECT count(*)::int AS n FROM categories WHERE name = 'Bebidas'")).rows[0].n, 0);
});

test('editar categoria para um nome que já existe é recusado com mensagem clara', async () => {
  await post('/categories', { name: 'Limpeza' });
  const id = await idOf('categories', 'Limpeza');
  const res = await post(`/categories/${id}`, { name: 'Bebidas geladas' });
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Já existe um registro com esse nome/);
  assert.strictEqual((await pool.query('SELECT name FROM categories WHERE id = $1', [id])).rows[0].name, 'Limpeza');
});

test('fornecedor criado pode ser editado (nome, e-mail e telefone)', async () => {
  await post('/suppliers', { name: 'Distribuidora A', email: 'a@exemplo.com', phone: '2111-1111' });
  const id = await idOf('suppliers', 'Distribuidora A');
  const res = await post(`/suppliers/${id}`, { name: 'Distribuidora Alfa', email: 'alfa@exemplo.com', phone: '' });
  assert.strictEqual(res.status, 302);
  const { rows } = await pool.query('SELECT name, email, phone FROM suppliers WHERE id = $1', [id]);
  assert.deepStrictEqual(rows[0], { name: 'Distribuidora Alfa', email: 'alfa@exemplo.com', phone: null });
});

test('edição recusa nome vazio, id inexistente e id inválido', async () => {
  const id = await idOf('suppliers', 'Distribuidora Alfa');
  const vazio = await post(`/suppliers/${id}`, { name: '   ', email: '', phone: '' });
  assert.strictEqual(vazio.status, 422);
  assert.match(await vazio.text(), /Informe o nome/);
  assert.strictEqual((await get('/categories/9999/edit')).status, 404);
  assert.strictEqual((await post('/categories/9999', { name: 'X' })).status, 404);
  assert.strictEqual((await get('/suppliers/abc/edit')).status, 404);
  const novo = await post('/categories', { name: '  ' });
  assert.strictEqual(novo.status, 422);
});

// ---------- Login ----------
test('sem login, qualquer tela e qualquer ação vão para /login; /health continua aberto', async () => {
  for (const path of ['/', '/categories', '/suppliers/1/edit', '/movements', '/import', '/products/new']) {
    const res = await fetch(base + path, { redirect: 'manual' });
    assert.strictEqual(res.status, 303, path);
    assert.strictEqual(res.headers.get('location'), '/login', path);
  }
  const acao = await postAnon('/categories', { name: 'Invasora' });
  assert.strictEqual(acao.status, 303);
  assert.strictEqual((await pool.query("SELECT count(*)::int AS n FROM categories WHERE name = 'Invasora'")).rows[0].n, 0);
  assert.strictEqual((await fetch(base + '/health')).status, 200);
  assert.strictEqual((await fetch(base + '/login')).status, 200);
  assert.strictEqual((await fetch(base + '/style.css')).status, 200);
});

test('senha ou usuário errados são recusados e não geram sessão', async () => {
  for (const body of [{ username: 'admin', password: 'errada' }, { username: 'outro', password: SENHA }, { username: '', password: '' }]) {
    const res = await postAnon('/login', body);
    assert.strictEqual(res.status, 401);
    assert.match(await res.text(), /Usuário ou senha inválidos/);
    assert.strictEqual(res.headers.get('set-cookie'), null);
  }
});

test('login correto cria cookie HttpOnly e dá acesso; sair encerra a sessão', async () => {
  const res = await postAnon('/login', { username: 'admin', password: SENHA });
  assert.strictEqual(res.status, 303);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const sessao = cookieFrom(res);
  assert.strictEqual((await fetch(base + '/', { headers: { Cookie: sessao } })).status, 200);

  const saida = await fetch(base + '/logout', { method: 'POST', redirect: 'manual', headers: { Cookie: sessao } });
  assert.strictEqual(saida.status, 303);
  assert.match(saida.headers.get('set-cookie'), /Max-Age=0/);
});

test('cookie adulterado, de outro segredo ou vencido não vale', () => {
  const valido = createSession('admin', SEGREDO);
  assert.strictEqual(readSession(valido, SEGREDO).u, 'admin');
  const [payload] = valido.split('.');
  const forjado = Buffer.from(JSON.stringify({ u: 'admin', exp: 9999999999 })).toString('base64url');
  assert.strictEqual(readSession(`${forjado}.${valido.split('.')[1]}`, SEGREDO), null); // payload trocado
  assert.strictEqual(readSession(valido, 'outro-segredo-com-mais-de-32-caracteres!!'), null);
  assert.strictEqual(readSession(payload, SEGREDO), null);
  assert.strictEqual(readSession('lixo', SEGREDO), null);
  const antigo = createSession('admin', SEGREDO, Date.now() - 9 * 60 * 60 * 1000); // criado há 9 h (limite: 8 h)
  assert.strictEqual(readSession(antigo, SEGREDO), null);
});

test('a senha não é guardada em texto: hash scrypt com sal diferente a cada vez', () => {
  const a = hashPassword('abc'); const b = hashPassword('abc');
  assert.match(a, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.notStrictEqual(a, b);
  assert.ok(require('../src/auth').verifyPassword('abc', a));
  assert.ok(!require('../src/auth').verifyPassword('abd', a));
});
