// Gera o hash (scrypt) de uma senha para usar em ADMIN_PASSWORD_HASH.
// Uso:  npm run -s hash-password -- 'minha senha'
const { hashPassword } = require('../src/auth');

const senha = process.argv[2];
if (!senha) {
  console.error("Uso: npm run -s hash-password -- 'sua senha'");
  process.exit(1);
}
console.log(hashPassword(senha));
