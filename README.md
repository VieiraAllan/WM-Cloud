# WM Cloud (Warehouse Management Cloud)

Sistema web de gestão de estoque criado para o projeto de Infraestrutura e Arquiteturas para Suporte às Aplicações (Unisuam), hospedado na AWS.

- `app/` aplicação Node.js + Express + EJS + PostgreSQL
- `docs/` documento da entrega parcial

## Rodando localmente

```bash
cd app
npm install
export DATABASE_URL=postgres://usuario:senha@localhost:5432/wmcloud
npm start            # http://localhost:3000
npm test             # testes de integração (exigem o PostgreSQL acima)
```

As tabelas são criadas automaticamente na inicialização (`app/src/schema.sql`).

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (ou `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) |
| `PGSSL=true` | habilita TLS na conexão (RDS) |
| `PORT` | porta HTTP (padrão 3000) |

## Funcionalidades

Cadastro de produtos, categorias e fornecedores; entradas e saídas transacionais (saída nunca deixa o saldo negativo); estoque atual com alerta de estoque mínimo; histórico de movimentações; importação de planilha CSV (`app/sample/produtos_exemplo.csv`).

A aplicação não guarda sessão em memória, então pode rodar em várias instâncias atrás de um balanceador. O endpoint `/health` (sem banco) serve ao health check do ALB e `/health/db` verifica também o banco.
