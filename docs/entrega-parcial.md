# WM Cloud (Warehouse Management Cloud)

**Projeto de Infraestrutura e Arquiteturas para Suporte às Aplicações**
Centro Universitário Augusto Motta (Unisuam) — Tecnologia em Análise e Desenvolvimento de Sistemas
Rio de Janeiro - RJ, 2026

> RASCUNHO da entrega parcial (Escopo + Cronograma). Itens entre [colchetes] precisam ser preenchidos por você (nomes, professor, datas).

---

## 1. Introdução e Proposta

Empresas de distribuição de médio porte ainda controlam o estoque em planilhas eletrônicas. Esse modelo gera divergência de saldo, falta de histórico confiável das movimentações, ruptura de produtos por ausência de alertas e dificuldade de trabalho simultâneo entre vários usuários.

Este projeto propõe o **WM Cloud**, um sistema web de gestão de estoque hospedado em infraestrutura de computação em nuvem na plataforma **AWS**. A proposta é projetar, implantar e testar uma infraestrutura IaaS que suporte a aplicação com banco de dados relacional, com foco em disponibilidade, segurança, armazenamento com backup e controle de custos.

**Cenário de negócio:** distribuidora de médio porte com 2.000 a 3.000 SKUs, cerca de 30 usuários simultâneos e picos de acesso no início e no fim do expediente. Hoje o controle é feito em planilhas Excel, que serão migradas para o sistema na nuvem.

## 2. Produto

Aplicação Web de gestão de estoque em infraestrutura Cloud Computing, com:

a) **Cadastros:** produtos, categorias e fornecedores;
b) **Entradas e saídas** de mercadorias, com validação que impede estoque negativo;
c) **Estoque atual** por produto;
d) **Histórico de movimentações**;
e) **Estoque mínimo e alertas** de estoque baixo;
f) **Importação inicial** dos dados das planilhas (migração);
g) Endpoint `/health` para verificação de saúde pelo balanceador de carga.

## 3. Resultado Esperado

Apresentar testes na infraestrutura criada demonstrando que a solução suporta a aplicação implantada: resposta estável sob carga de 30 usuários simultâneos (teste com k6 ou JMeter), continuidade do serviço após a queda proposital de uma instância (Auto Scaling + balanceador) e dados preservados por backup automático do banco.

## 4. Objetivo Geral

Implantar uma nuvem computacional de infraestrutura na AWS para hospedar a aplicação web WM Cloud, com banco de dados relacional, alta disponibilidade e segurança.

## 5. Objetivos Específicos

- Criar um modelo de implantação de infraestrutura como serviço (IaaS) na AWS;
- Montar a infraestrutura proposta: VPC com duas zonas de disponibilidade, EC2 em Auto Scaling Group atrás de um Application Load Balancer, RDS PostgreSQL e S3;
- Implantar a aplicação de forma automatizada (Launch Template com *user data*) e sem estado, permitindo escalar horizontalmente;
- Avaliar o comportamento da infraestrutura por testes funcionais, de integração, de desempenho, de segurança e de disponibilidade;
- Elaborar o plano de transição das planilhas atuais para o sistema na nuvem;
- Documentar a arquitetura de produção (Multi-AZ, NAT Gateway, HTTPS) e a estimativa de custos, mantendo o ambiente de demonstração dentro dos créditos do AWS Academy.

## 6. Escopo

### 6.1 Requisitos funcionais
- CRUD de produtos, categorias e fornecedores;
- Registro de entradas e saídas com validação de saldo;
- Tela de estoque atual com destaque para itens abaixo do mínimo;
- Histórico de movimentações com filtros;
- Importação de dados a partir de arquivo CSV exportado das planilhas.

### 6.2 Requisitos não funcionais
- **Disponibilidade:** continuar operando se uma instância falhar;
- **Desempenho:** atender 30 usuários simultâneos com tempo de resposta aceitável;
- **Segurança:** banco em sub-rede privada, acesso por Security Groups em camadas, porta do banco acessível apenas pela aplicação;
- **Integridade:** movimentações em transações no banco;
- **Custo:** ambiente de demonstração dentro dos créditos do laboratório.

### 6.3 Definição dos elementos de HW e SW

| Item | Ambiente de demonstração (implantado) | Ambiente de produção (documentado) |
|---|---|---|
| Computação | EC2 `t3.micro`/`t3.small`, Auto Scaling mín. 1 e máx. 2 | EC2 `t3.medium`, Auto Scaling mín. 2 e máx. 4 |
| Rede e segurança | VPC, sub-redes em 2 AZs, Internet Gateway, ALB, Security Groups | + sub-redes privadas para app, NAT Gateway, HTTPS com ACM, WAF |
| Banco de dados | RDS PostgreSQL `db.t3.micro`, Single-AZ, 20 GB, backup automático | RDS PostgreSQL Multi-AZ |
| Armazenamento | S3 (arquivos de importação e exportação), snapshots do RDS | S3 com versionamento e replicação |
| Monitoramento | CloudWatch (CPU, 5xx, conexões do banco) | + alarmes com notificação por SNS |
| Software | Amazon Linux 2023, Node.js, Express, PostgreSQL, PM2 | idem |

**Stack da aplicação (JavaScript):** Node.js + Express (API e páginas), páginas renderizadas com EJS (HTML/CSS), PostgreSQL. A aplicação fica em um único processo por instância e sem sessão em memória.

## 7. Cronograma de Execução (Apêndice A)

| Fase | Atividade | S1 | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|---|---|
| 1. Planejamento | Escopo, requisitos e desenho da arquitetura | ■ | | | | | |
| 2. Aplicação | Modelagem do banco e API (produtos, movimentações) | | ■ | | | | |
| | Telas, alertas de estoque mínimo e importação CSV | | ■ | ■ | | | |
| 3. Infraestrutura AWS | VPC, sub-redes, Security Groups | | | ■ | | | |
| | RDS, S3, Launch Template e Auto Scaling | | | ■ | ■ | | |
| | ALB e health check | | | | ■ | | |
| 4. Testes | Funcionais e de integração | | | | ■ | | |
| | Carga (k6/JMeter), segurança e disponibilidade (derrubar instância) | | | | | ■ | |
| 5. Transição | Plano de migração das planilhas e importação de teste | | | | | ■ | |
| 6. Finalização | Documentação final, estimativa de custos e apresentação | | | | | ■ | ■ |

> Ajuste a duração e as semanas conforme o calendário real da disciplina.

## 8. Resultados Esperados

- **Para a empresa:** estoque confiável, histórico de movimentações e alertas de reposição;
- **Para os usuários:** acesso simultâneo, rápido e disponível pela internet;
- **Para a infraestrutura:** ambiente reproduzível, escalável e tolerante a falhas, com arquitetura de produção documentada e custo controlado.
