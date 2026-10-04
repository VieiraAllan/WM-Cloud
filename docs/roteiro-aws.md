# Roteiro AWS (Learner Lab) — WM Cloud

Baseado no Readme do Learner Lab informado por você (não verificado por mim no console): região **us-east-1**, orçamento **US$ 50**, IAM só com `LabRole`/`LabInstanceProfile`, EC2 de nano a large (máx. 9 instâncias), RDS PostgreSQL de nano a medium, sessão de 4 h.

## Regras de custo (valem para todas as etapas)

- Só crie ALB e RDS nos dias de teste e apresentação. No fim de cada sessão: **apague o ALB** e **pare o RDS** (o lab não faz isso sozinho).
- Nunca crie NAT Gateway nem Elastic IP. Nunca chegue perto de 20 instâncias (desativa a conta).
- Confira o painel de gasto depois de criar ALB/RDS (atualiza a cada 8 a 12 h).
- Fique em us-east-1 em todas as telas do console.

## Etapa 1 — Rede (custo zero)

1. VPC `wm-vpc`, CIDR `10.0.0.0/16`.
2. Sub-redes: `wm-pub-a` (10.0.1.0/24, us-east-1a), `wm-pub-b` (10.0.2.0/24, us-east-1b), `wm-db-a` (10.0.11.0/24, us-east-1a), `wm-db-b` (10.0.12.0/24, us-east-1b). Nas públicas, ative "atribuir IPv4 público automaticamente".
3. Internet Gateway `wm-igw` ligado à VPC. Tabela de rotas pública com `0.0.0.0/0 → wm-igw`, associada às duas sub-redes públicas. As sub-redes `wm-db-*` ficam só com a rota local (privadas).
4. Security Groups (camadas):
   - `wm-alb-sg`: entrada TCP 80 de 0.0.0.0/0.
   - `wm-app-sg`: entrada TCP 3000 **somente** de `wm-alb-sg`. Sem SSH aberto (use Session Manager, se disponível).
   - `wm-db-sg`: entrada TCP 5432 **somente** de `wm-app-sg`.

## Etapa 2 — Pacote da aplicação no S3

No seu computador (com o repositório clonado) ou no CloudShell:

```bash
cd WM-Cloud
tar --exclude=node_modules -czf wm-cloud.tgz app
aws s3 mb s3://wm-cloud-SEUNOME --region us-east-1
aws s3 cp wm-cloud.tgz s3://wm-cloud-SEUNOME/
```

## Etapa 3 — Banco (RDS)

PostgreSQL 16, modelo **Free tier/Dev**, `db.t3.micro`, 20 GB gp2, **Single-AZ**, sem acesso público, `wm-db-sg`, grupo de sub-redes com `wm-db-a` e `wm-db-b`, banco inicial `wmcloud`, usuário `wm`, backup automático ligado (retenção de 1 a 7 dias), **monitoramento aprimorado desmarcado**, sem proteção contra exclusão. Anote o endpoint.

## Etapa 4 — Launch Template e Auto Scaling

1. Launch Template `wm-lt`: Amazon Linux 2023, `t3.micro`, par de chaves `vockey`, `wm-app-sg`, **perfil de instância `LabInstanceProfile`**, user data = `infra/user-data.sh` com as variáveis preenchidas.
2. Auto Scaling Group `wm-asg`: sub-redes `wm-pub-a` e `wm-pub-b`, mín. 1, **desejado 2 nos dias de teste**, máx. 2 a 4, verificação de saúde **ELB** ligada, carência de 300 s.
3. Política de escala por CPU média 60%.

## Etapa 5 — ALB

ALB `wm-alb` (internet-facing, sub-redes públicas, `wm-alb-sg`), listener HTTP 80 → target group `wm-tg` (HTTP, porta 3000, **health check `/health`**), ligado ao ASG. O DNS do ALB é o endereço da aplicação (não precisa de Elastic IP).

## Etapa 6 — Monitoramento

CloudWatch Alarms: CPU do ASG > 70%, `HTTPCode_Target_5XX_Count` do ALB, `UnHealthyHostCount` do target group e `DatabaseConnections` do RDS.

## Etapa 7 — Testes (juntar no mesmo dia, ALB ligado uma vez só)

1. **Funcional:** abrir o DNS do ALB, importar `app/sample/produtos_exemplo.csv`, registrar entrada e saída, tentar saída maior que o saldo (deve recusar).
2. **Carga:** `k6 run -e BASE_URL=http://DNS-DO-ALB infra/k6-load.js` (7 min, 30 usuários). Guarde o resumo e prints do CloudWatch.
3. **Disponibilidade:** com 2 instâncias, encerre uma no EC2 durante o k6 e mostre que o site continua respondendo e que o ASG cria outra.
4. **Segurança:** tentar acessar a porta 3000 da instância e a 5432 do banco pela internet (devem falhar); mostrar as regras dos Security Groups.
5. **Backup:** criar um snapshot manual do RDS e mostrar o backup automático.

## Etapa 8 — Encerramento de cada sessão

Apagar ALB e target group, reduzir o ASG para 0 (ou apagar), parar o RDS. Conferir o gasto.

## Só documentado (produção)

RDS Multi-AZ, sub-redes privadas para a aplicação com NAT Gateway, HTTPS com ACM e domínio próprio (o lab não registra domínio), WAF, Secrets Manager para a senha do banco.

## Pontos a conferir na primeira subida

- `dnf install nodejs22/nodejs20` no Amazon Linux 2023: se falhar, veja `/var/log/cloud-init-output.log` (me mande o trecho).
- Se o health check do ALB ficar "unhealthy": confirme o `wm-app-sg` (3000 vindo do ALB) e `systemctl status wm-cloud` na instância.
