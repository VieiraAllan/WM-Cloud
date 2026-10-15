# WM Cloud (Warehouse Management Cloud)

Sistema web de gestão de estoque criado para o projeto de Infraestrutura e Arquiteturas para Suporte às Aplicações (Unisuam), hospedado na AWS.

- `app/` aplicação Node.js + Express + EJS + PostgreSQL
- `docs/` documento da entrega parcial

## Rodando localmente

```bash
cd app
npm install
export DATABASE_URL=postgres://usuario:senha@localhost:5432/wmcloud
export ADMIN_PASSWORD_HASH="$(npm run -s hash-password -- 'escolha-uma-senha')"
export SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
npm start            # http://localhost:3000  (usuário: admin)
npm test             # testes de integração (exigem o PostgreSQL acima)
```

As tabelas são criadas automaticamente na inicialização (`app/src/schema.sql`).

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (ou `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) |
| `PGSSL=true` | habilita TLS na conexão (RDS) |
| `PORT` | porta HTTP (padrão 3000) |
| `ADMIN_PASSWORD_HASH` | **obrigatória.** Hash scrypt da senha do administrador (gere com `npm run -s hash-password -- 'senha'`) |
| `SESSION_SECRET` | **obrigatória.** Chave que assina o cookie de sessão (mínimo de 32 caracteres; a mesma em todas as instâncias) |
| `ADMIN_USER` | usuário do administrador (padrão `admin`) |
| `COOKIE_SECURE=true` | marca o cookie como `Secure`; use somente quando o site for servido por HTTPS |

Sem `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` a aplicação se recusa a iniciar, para nunca subir sem proteção.

## Funcionalidades

Login com usuário único (administrador); cadastro, edição e exclusão de produtos, categorias e fornecedores; entradas e saídas transacionais (saída nunca deixa o saldo negativo); estoque atual com alerta de estoque mínimo; histórico de movimentações; importação de planilha CSV (`app/sample/produtos_exemplo.csv`).

A aplicação não guarda sessão em memória (a sessão do login fica em um cookie assinado), então pode rodar em várias instâncias atrás de um balanceador. Todas as telas exigem login; só `/health` (sem banco, serve ao health check do ALB) e `/health/db` (verifica também o banco) ficam abertos.
