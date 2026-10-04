#!/bin/bash
# User data do Launch Template (Amazon Linux 2023). Executa no primeiro boot da instância.
# ANTES DE USAR, preencha as 4 variáveis abaixo. Log: /var/log/cloud-init-output.log
set -euxo pipefail

BUCKET="NOME-DO-SEU-BUCKET"                 # bucket S3 com o pacote da aplicação
PACOTE="wm-cloud.tgz"                       # arquivo enviado ao bucket (ver docs/roteiro-aws.md)
DB_HOST="ENDPOINT-DO-RDS.us-east-1.rds.amazonaws.com"
DB_PASS="SENHA-DO-BANCO"                    # laboratório: em produção usar Secrets Manager
DB_USER="wm"
DB_NAME="wmcloud"

# Node.js >= 20 (exigência das dependências)
dnf install -y nodejs22 || dnf install -y nodejs20

# Código da aplicação (a LabRole do instance profile permite ler o S3)
mkdir -p /opt/wm-cloud
aws s3 cp "s3://${BUCKET}/${PACOTE}" /tmp/app.tgz --region us-east-1
tar -xzf /tmp/app.tgz -C /opt/wm-cloud
cd /opt/wm-cloud/app
npm ci --omit=dev

# Variáveis de ambiente da aplicação
cat > /etc/wm-cloud.env <<ENV
PORT=3000
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}
PGSSL=true
ENV
chmod 600 /etc/wm-cloud.env

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
