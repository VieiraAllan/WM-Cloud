// Autenticação de usuário único (administrador), sem estado no servidor:
// a sessão vive em um cookie assinado com HMAC, então qualquer instância atrás
// do balanceador consegue validá-la, desde que todas usem o mesmo SESSION_SECRET.
const crypto = require('crypto');

const COOKIE_NAME = 'wm_session';
const SESSION_SECONDS = 8 * 60 * 60; // 8 horas

// ---------- Senha (scrypt com sal aleatório) ----------
// Formato guardado: scrypt:<sal em hex>:<hash em hex>
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split(':');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- Sessão (cookie assinado) ----------
const sign = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

function createSession(username, secret, nowMs = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Math.floor(nowMs / 1000) + SESSION_SECONDS,
  })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function readSession(token, secret, nowMs = Date.now()) {
  if (typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload, secret));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.u || !(data.exp > nowMs / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

// ---------- Configuração ----------
// Falha ao iniciar se não estiver configurado: melhor não subir do que subir sem proteção.
function loadConfig(env = process.env) {
  const username = (env.ADMIN_USER || 'admin').trim();
  const passwordHash = env.ADMIN_PASSWORD_HASH;
  const secret = env.SESSION_SECRET;
  if (!passwordHash || !secret || secret.length < 32) {
    throw new Error('Login não configurado: defina ADMIN_PASSWORD_HASH e SESSION_SECRET (mínimo de 32 caracteres).');
  }
  return { username, passwordHash, secret, secureCookie: env.COOKIE_SECURE === 'true' };
}

function createAuth(config) {
  const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${config.secureCookie ? '; Secure' : ''}`;

  const currentUser = (req) => {
    const session = readSession(parseCookies(req.headers.cookie)[COOKIE_NAME], config.secret);
    return session ? session.u : null;
  };

  return {
    currentUser,

    // Barra qualquer requisição sem sessão válida e manda para a tela de login.
    requireLogin(req, res, next) {
      if (currentUser(req)) return next();
      return res.redirect(303, '/login');
    },

    // Confere usuário e senha. A senha é sempre verificada, mesmo com usuário errado,
    // para que o tempo de resposta não revele se o usuário existe.
    checkCredentials(username, password) {
      const passwordOk = verifyPassword(password, config.passwordHash);
      const given = Buffer.from(String(username || '').trim());
      const wanted = Buffer.from(config.username);
      const userOk = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
      return passwordOk && userOk;
    },

    startSession(res) {
      const token = createSession(config.username, config.secret);
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Max-Age=${SESSION_SECONDS}; ${cookieFlags}`);
    },

    endSession(res) {
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; ${cookieFlags}`);
    },
  };
}

module.exports = { hashPassword, verifyPassword, createSession, readSession, parseCookies, loadConfig, createAuth, COOKIE_NAME };
