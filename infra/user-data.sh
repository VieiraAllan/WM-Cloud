#!/bin/bash
# User data do Launch Template (Amazon Linux 2023). Executa no primeiro boot da instância.
# ANTES DE USAR, preencha as 4 variáveis abaixo. Log: /var/log/cloud-init-output.log
#
# Nenhuma senha fica neste script: a senha do banco (gerada pelo RDS) e as credenciais
# do administrador do sistema são lidas do AWS Secrets Manager na hora do boot,
# usando a LabRole do instance profile.
set -euxo pipefail
export HOME=/root

BUCKET="NOME-DO-SEU-BUCKET"                 # bucket S3 com o pacote da aplicação
DB_HOST="ENDPOINT-DO-RDS.us-east-1.rds.amazonaws.com"
DB_SECRET_ARN="ARN-DO-SEGREDO-DO-RDS"       # criado pelo RDS (--manage-master-user-password)
APP_SECRET_ARN="wm-cloud/admin"             # JSON: username, password, session_secret (ver docs/roteiro-aws.md)
PACOTE="wm-cloud.tgz"                       # arquivo enviado ao bucket

# Node.js >= 20 (exigência das dependências)
dnf install -y nodejs22 || dnf install -y nodejs20

# Código da aplicação (a LabRole do instance profile permite ler o S3)
mkdir -p /opt/wm-cloud
aws s3 cp "s3://${BUCKET}/${PACOTE}" /tmp/app.tgz --region us-east-1
tar -xzf /tmp/app.tgz -C /opt/wm-cloud
cd /opt/wm-cloud/app
npm ci --omit=dev

# Variáveis de ambiente da aplicação. A senha do administrador vira um hash (scrypt) aqui
# mesmo; o texto da senha nunca é gravado em disco. Todas as instâncias recebem o mesmo
# SESSION_SECRET, por isso uma sessão iniciada em uma instância vale nas outras.
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" --region us-east-1 --query SecretString --output text)
APP_SECRET=$(aws secretsmanager get-secret-value --secret-id "$APP_SECRET_ARN" --region us-east-1 --query SecretString --output text)
DB_SECRET="$DB_SECRET" APP_SECRET="$APP_SECRET" DB_HOST="$DB_HOST" node -e '
const q = JSON.stringify;
const db = JSON.parse(process.env.DB_SECRET);
const app = JSON.parse(process.env.APP_SECRET);
const { hashPassword } = require("/opt/wm-cloud/app/src/auth.js");
const linhas = [
  "PORT=3000",
  "PGSSL=true",
  "PGHOST=" + q(process.env.DB_HOST),
  "PGPORT=5432",
  "PGUSER=" + q(db.username),
  "PGDATABASE=wmcloud",
  "PGPASSWORD=" + q(db.password),
  "ADMIN_USER=" + q(app.username),
  "ADMIN_PASSWORD_HASH=" + q(hashPassword(app.password)),
  "SESSION_SECRET=" + q(app.session_secret),
];
const nl = String.fromCharCode(10);
require("fs").writeFileSync("/etc/wm-cloud.env", linhas.join(nl) + nl, { mode: 0o600 });
'

# Serviço systemd: reinicia sozinho se cair e sobe a cada boot
cat > /etc/systemd/system/wm-cloud.service <<'UNIT'
[Unit]
Description=WM Cloud
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/wm-cloud/app
EnvironmentFile=/etc/wm-cloud.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
User=nobody

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now wm-cloud
