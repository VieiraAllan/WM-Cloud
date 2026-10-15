
**Documentação Projeto WM Cloud**

Projeto de Infraestrutura e Arquiteturas para Suporte às Aplicações

Professor: Vinicius Pinto da Silva

**ELABORADO POR:**

Állan Ribeiro Vieira - 25107225

Lucas Concentino - 24201597

Lucas da Silva de Maria - 24202179

**Rio de Janeiro - RJ**

**2026**









## **1. INTRODUÇÃO**

Armazéns de médio porte, de qualquer tipo de produto, ainda controlam o estoque em planilhas eletrônicas. Esse modelo dificulta o acompanhamento do saldo em tempo real, o trabalho simultâneo de vários usuários e a rastreabilidade das movimentações. A computação em nuvem permite hospedar um sistema dedicado a essa função com disponibilidade, segurança e custo controlado, sem a compra de servidores.

Este projeto propõe o **WM Cloud (Warehouse Management Cloud)**, um sistema web de gestão de estoque hospedado na plataforma AWS. A proposta é projetar, implantar e testar uma infraestrutura como serviço (IaaS) capaz de suportar a aplicação com banco de dados relacional, com foco em disponibilidade, segurança, armazenamento com backup e controle de custos.

O cenário de negócio adotado é o de um armazém de médio porte, com 2.000 a 3.000 itens (SKUs), cerca de 30 usuários simultâneos e picos de acesso no início e no fim do expediente. Atualmente, o controle é feito em planilhas Excel, que serão migradas para o sistema na nuvem.

**1.1 Problema**

O problema central está na dificuldade de manter o saldo de estoque correto e disponível para vários usuários ao mesmo tempo usando planilhas. Percebem-se divergência de saldo entre cópias do arquivo, ausência de um histórico confiável das entradas e saídas, ruptura de produtos por falta de alertas de estoque mínimo e risco de perda de dados por falta de backup e redundância.

Manter um sistema próprio exige servidores, rede, segurança e rotinas de backup que muitas empresas não têm estrutura para operar. Falta uma solução simples, acessível pela internet e com infraestrutura planejada para suportar o uso diário.

**1.2 Produto**

Aplicação Web de gestão de estoque em infraestrutura Cloud Computing, com as seguintes funcionalidades:

- **Cadastros:** produtos, categorias e fornecedores, com cadastro, edição e exclusão;

- **Entradas e saídas:** registro de mercadorias, com validação que impede estoque negativo;

- **Estoque atual:** saldo por produto, com busca e destaque dos itens abaixo do mínimo;

- **Histórico de movimentações:** consulta com filtros por tipo e por produto;

- **Estoque mínimo e alertas:** aviso de estoque baixo na tela principal;

- **Importação inicial:** carga dos dados das planilhas atuais por arquivo CSV, apoiando a migração;

- **Acesso restrito:** login com usuário único (administrador) e botão Sair; todas as telas, exceto a verificação de saúde, exigem login;

- **Verificação de saúde:** endpoint /health usado pelo balanceador de carga.

**1.3 Objetivo Geral**

Implantar uma nuvem computacional de infraestrutura na plataforma AWS para a hospedagem da aplicação web WM Cloud, com banco de dados relacional, alta disponibilidade e segurança.

**1.4 Objetivos Específicos**

Para concretizar esse trabalho, o projeto teve os seguintes objetivos específicos:

- **Modelar a implantação:** criar um modelo de implantação de nuvem de infraestrutura como serviço (IaaS);

- **Montar a infraestrutura:** VPC em duas zonas de disponibilidade, servidores EC2 em Auto Scaling atrás de um Application Load Balancer, banco RDS PostgreSQL e armazenamento S3;

- **Automatizar a implantação:** publicar a aplicação de forma automatizada e sem estado, permitindo o escalonamento horizontal;

- **Avaliar a infraestrutura:** realizar testes funcionais, de integração, de desempenho, de segurança e de disponibilidade;

- **Planejar a transição:** elaborar o plano de migração das planilhas atuais para o sistema na nuvem;

- **Controlar custos:** documentar a arquitetura de produção e a estimativa de custos, mantendo o ambiente de demonstração dentro dos créditos do AWS Academy.

**1.5 Resultado Esperado**

Apresentar testes na infraestrutura criada, demonstrando que a solução foi capaz de suportar a aplicação implantada, utilizando de forma eficiente os principais serviços configurados na plataforma AWS: resposta estável sob a carga de 30 usuários simultâneos, continuidade do serviço após a queda proposital de uma instância e preservação dos dados por meio de backup automático do banco.

## **2. REQUISITOS**

A\) Funcionais (usuário pode fazer):

- **Cadastros**

RF01 - O sistema deve permitir cadastrar, consultar, editar e excluir produtos;

RF02 - O sistema deve permitir cadastrar, editar e excluir categorias e fornecedores;

RF03 - O sistema deve impedir o cadastro de dois produtos com o mesmo SKU;

- **Movimentações**

RF04 - O sistema deve permitir registrar a entrada de mercadorias;

RF05 - O sistema deve permitir registrar a saída de mercadorias;

RF06 - O sistema deve recusar uma saída maior que o saldo disponível, sem alterar o estoque;

RF07 - O sistema deve permitir informar uma observação em cada movimentação;

- **Estoque atual**

RF08 - O sistema deve exibir o saldo atual de cada produto;

RF09 - O sistema deve permitir buscar produtos por nome ou SKU;

RF10 - O sistema deve destacar produtos com estoque igual ou abaixo do mínimo e exibir a quantidade de alertas;

RF11 - O sistema deve permitir filtrar somente os produtos com estoque baixo;

- **Histórico**

RF12 - O sistema deve manter o histórico de todas as movimentações, com data, tipo, quantidade e observação;

RF13 - O sistema deve permitir filtrar o histórico por tipo de movimentação e por produto;

- **Migração de dados**

RF14 - O sistema deve permitir importar produtos, categorias, fornecedores e estoque inicial a partir de arquivo CSV;

RF15 - O sistema deve atualizar o cadastro de produtos já existentes na reimportação, sem duplicá-los nem lançar o estoque novamente;

RF16 - O sistema deve informar as linhas inválidas do arquivo importado;

- **Monitoramento**

RF17 - O sistema deve disponibilizar o endpoint /health para a verificação de saúde pelo balanceador de carga;

RF18 - O sistema deve disponibilizar o endpoint /health/db para verificar a conexão com o banco de dados.

- **Acesso e validações**

RF19 - O sistema deve exigir login (usuário e senha) para acessar qualquer tela ou ação, exceto /health e /health/db;

RF20 - O sistema deve recusar usuário ou senha inválidos, sem informar qual dos dois está errado;

RF21 - O sistema deve permitir encerrar a sessão por meio do botão Sair;

RF22 - O sistema deve impedir nome vazio ou repetido ao cadastrar ou editar categorias e fornecedores, informando o motivo.

B\) Não Funcionais

- **Usabilidade**

RNF01 - O sistema deve possuir interface simples e de fácil utilização, adaptável a telas menores;

RNF02 - O sistema deve exibir mensagens de erro claras ao usuário;

- **Desempenho**

RNF03 - O sistema deve atender 30 usuários simultâneos, com 95% das respostas em menos de 1 segundo;

RNF04 - O sistema deve apresentar taxa de erros inferior a 1% sob essa carga;

- **Disponibilidade**

RNF05 - O sistema deve continuar operando se uma instância de servidor falhar, com recomposição automática pelo Auto Scaling;

RNF06 - A aplicação deve ser executada sem estado, permitindo várias instâncias atrás do balanceador de carga;

- **Segurança**

RNF07 - O banco de dados deve ficar em sub-rede privada e aceitar conexões apenas da aplicação, por meio de Security Groups;

RNF08 - Os servidores da aplicação devem aceitar tráfego somente vindo do balanceador de carga;

RNF09 - A conexão da aplicação com o banco de dados deve ser criptografada (TLS);

- **Integridade e backup**

RNF10 - As movimentações devem ser gravadas em transações, e o banco deve impedir saldo negativo;

RNF11 - O banco de dados deve possuir backup automático.

- **Custo**

RNF12 - O ambiente de demonstração deve permanecer dentro dos créditos do AWS Academy (US\$ 50);

RNF13 - Os recursos cobrados por hora (balanceador e banco) devem permanecer ligados apenas nos dias de teste e apresentação.

- **Autenticação e segredos**

RNF14 - A senha do administrador deve ser guardada somente como hash (scrypt com sal aleatório), nunca em texto;

RNF15 - A sessão deve ser um cookie assinado (HttpOnly, SameSite=Lax, validade de 8 horas), sem estado no servidor, de modo que qualquer instância atrás do balanceador a reconheça;

RNF16 - As senhas do banco e do administrador devem ficar no AWS Secrets Manager, fora do código e do user data;

RNF17 - Em produção, o acesso deve ocorrer exclusivamente por HTTPS. No ambiente de demonstração o acesso é por HTTP, pois o laboratório não registra domínio para emitir certificado no ACM; por isso a senha trafega sem criptografia nesse ambiente.

## **3. TELAS**

A\) Acesso

- Tela de login (usuário e senha), com mensagem de erro para credenciais inválidas

- Botão Sair no menu superior, que encerra a sessão

B\) Estoque

- Tela de estoque atual, com busca, alerta de estoque baixo e atalhos de entrada, saída, edição e exclusão

- Menu superior de navegação entre as telas

C\) Cadastros

- Tela de novo produto e de edição de produto

- Tela de categorias, com cadastro, edição e exclusão

- Tela de edição de categoria

- Tela de fornecedores, com cadastro, edição e exclusão

- Tela de edição de fornecedor (nome, e-mail e telefone)

D\) Movimentações

- Tela de histórico de movimentações, com filtros por tipo e produto

- Tela de nova movimentação (entrada ou saída)

E\) Migração

- Tela de importação de planilha (CSV), com o resultado da importação

## **4. CRONOGRAMA**

O planejamento das atividades foi estruturado em um diagrama de Gantt semanal. A semana 1 (02/10/2026 a 09/10/2026) correspondeu à elaboração e à entrega parcial (escopo e cronograma), entregue em 09/10/2026. A entrega final é em 22/11/2026, até as 23:59.

<table style="width:100%;">
<colgroup>
<col style="width: 16%" />
<col style="width: 34%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Fase</strong></th>
<th><strong>Atividade</strong></th>
<th><p><strong>S1</strong></p>
<p><strong>02/10</strong></p></th>
<th><p><strong>S2</strong></p>
<p><strong>09/10</strong></p></th>
<th><p><strong>S3</strong></p>
<p><strong>16/10</strong></p></th>
<th><p><strong>S4</strong></p>
<p><strong>23/10</strong></p></th>
<th><p><strong>S5</strong></p>
<p><strong>30/10</strong></p></th>
<th><p><strong>S6</strong></p>
<p><strong>06/11</strong></p></th>
<th><p><strong>S7</strong></p>
<p><strong>13/11</strong></p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>1. Planejamento</td>
<td>Escopo, requisitos, arquitetura e entrega parcial (09/10)</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td>2. Aplicação</td>
<td>Modelagem do banco e API (produtos e movimentações)</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td>Telas, alertas de estoque mínimo e importação CSV</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td>3. Infraestrutura AWS</td>
<td>VPC, sub-redes e Security Groups</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td></td>
<td>RDS, S3, Launch Template e Auto Scaling</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td>ALB e health check</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td>4. Testes</td>
<td>Funcionais e de integração</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td></td>
<td>Carga (k6), segurança e disponibilidade</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="odd">
<td>5. Transição</td>
<td>Plano de migração das planilhas e importação de teste</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr class="even">
<td>6. Finalização</td>
<td>Documentação final, estimativa de custos e ensaio da apresentação</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</tbody>
</table>

Todas as atividades terminam até 20/11/2026 (sexta-feira). O dia 21/11 fica como reserva para imprevistos, e o dia 22/11 é usado somente para o envio da entrega final.

## **5. INFRAESTRUTURA IMPLANTADA NA AWS**

O ambiente de demonstração foi implantado na região us-east-1, dentro dos limites do AWS Academy Learner Lab (crédito de US\$ 50). A arquitetura de produção é apenas documentada, com a estimativa de custos.

**5.1 Definição dos elementos de hardware e software**

| **Item**         | **Ambiente de demonstração (implantado)**                                                                          | **Ambiente de produção (documentado)**                                |
|------------------|--------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| Computação       | EC2 t3.micro; Auto Scaling mín. 1 e máx. 2 (1 instância em operação; 2 nos dias de teste)                          | EC2 t3.medium; Auto Scaling mín. 2 e máx. 4                           |
| Rede e segurança | VPC, sub-redes em 2 AZs, Internet Gateway, Application Load Balancer, Security Groups em camadas e Secrets Manager | Sub-redes privadas para a aplicação, NAT Gateway, HTTPS com ACM e WAF |
| Banco de dados   | RDS PostgreSQL db.t3.micro, Single-AZ, 20 GB, backup automático                                                    | RDS PostgreSQL Multi-AZ                                               |
| Armazenamento    | S3 (pacote da aplicação e arquivos de importação) e snapshots do RDS                                               | S3 com versionamento e replicação                                     |
| Monitoramento    | CloudWatch (CPU, erros 5xx, hosts não saudáveis, conexões do banco)                                                | CloudWatch com alarmes e notificação por SNS                          |
| Software         | Amazon Linux 2023, Node.js, Express, EJS e PostgreSQL                                                              | Idem                                                                  |

A aplicação é desenvolvida em JavaScript (Node.js com Express e páginas renderizadas com EJS), executa em um único processo por instância e não guarda estado local (a sessão do login vive em um cookie assinado), o que permite ao Auto Scaling criar novas instâncias automaticamente.

**5.2 Arquitetura implantada**

- **Rede:** VPC wm-vpc (10.0.0.0/16) em duas zonas de disponibilidade (us-east-1a e us-east-1b). Sub-redes públicas wm-pub-a e wm-pub-b para o balanceador e a aplicação; sub-redes wm-db-a e wm-db-b, sem rota para a internet, para o banco. Internet Gateway wm-igw. NAT Gateway não é usado, por causa do custo;

- **Security Groups em camadas:** wm-alb-sg (porta 80 aberta à internet), wm-app-sg (porta 3000 somente a partir do wm-alb-sg) e wm-db-sg (porta 5432 somente a partir do wm-app-sg). Nenhuma porta de administração (SSH) fica aberta;

- **Computação:** Launch Template wm-lt (Amazon Linux 2023, t3.micro, LabInstanceProfile) com user data que baixa o pacote da aplicação do S3, instala as dependências, lê os segredos e inicia o serviço (systemd, reinício automático). Auto Scaling Group wm-asg com mínimo 1, máximo 2, verificação de saúde pelo balanceador (carência de 300 s) e política de escala por CPU média de 60%;

- **Balanceamento:** Application Load Balancer wm-alb (HTTP, porta 80) com target group na porta 3000 e verificação de saúde em /health, que não depende do banco;

- **Banco de dados:** RDS PostgreSQL 16 (db.t3.micro, 20 GB, Single-AZ), sem acesso público, backup automático com retenção de 7 dias e conexão da aplicação com TLS;

- **Armazenamento:** bucket S3 com o pacote da aplicação (usado pelo Launch Template) e snapshots do RDS;

- **Segredos:** AWS Secrets Manager guarda a senha do banco (gerada e gerenciada pelo RDS) e o segredo wm-cloud/admin (usuário, senha e chave de sessão do administrador). A instância lê os segredos ao iniciar e grava o arquivo de ambiente com permissão restrita; nada fica no código nem no user data;

- **Monitoramento:** alarmes do CloudWatch para CPU do Auto Scaling (wm-asg-cpu-alta), erros 5xx do balanceador (wm-alb-erros-5xx), hosts não saudáveis (wm-tg-hosts-nao-saudaveis) e conexões do banco (wm-rds-conexoes).

**5.3 Segurança**

- **Isolamento:** o banco só aceita conexões da aplicação, e a aplicação só aceita tráfego do balanceador; instâncias e banco não são alcançáveis diretamente pela internet;

- **Autenticação:** login de usuário único com senha guardada como hash scrypt, sessão em cookie assinado (HttpOnly, SameSite=Lax, 8 horas), atraso nas tentativas inválidas e comparação em tempo constante. A aplicação se recusa a iniciar sem senha e chave de sessão configuradas;

- **Segredos:** mantidos no Secrets Manager e lidos pela função do perfil de instância; o Learner Lab oferece apenas a LabRole, por isso não foi possível aplicar o princípio do menor privilégio com funções separadas;

- **Limitações do ambiente de demonstração:** o acesso é por HTTP, pois o laboratório não permite registrar domínio nem emitir certificado no ACM, e o armazenamento do RDS não está criptografado. Na arquitetura de produção: HTTPS no balanceador, criptografia em repouso com KMS, aplicação em sub-redes privadas e WAF.

**5.4 Testes**

O quadro resume os testes definidos no escopo e a situação de cada um na data desta versão.

| **Teste**                 | **Como foi feito / evidência**                                                                                                                                                                              | **Situação**                                                  |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------|
| Funcional e de integração | npm test: 16 casos automatizados (movimentações, saldo, saídas simultâneas sem saldo negativo, SKU duplicado, importação CSV, edição de categorias e fornecedores, login e sessão) contra PostgreSQL        | Realizado em 14/10/2026: 16 de 16 aprovados                   |
| Funcional no ambiente AWS | Consulta pelo balanceador: /health e /health/db retornam 200; qualquer tela sem login redireciona para /login                                                                                               | Realizado em 14/10/2026                                       |
| Disponibilidade           | Instância encerrada em 14/10/2026 ao publicar a versão com login: o Auto Scaling criou a substituta e o balanceador a marcou como saudável em poucos minutos. Com 1 instância houve indisponibilidade breve | Parcial: repetir com 2 instâncias durante a carga             |
| Desempenho                | k6, 30 usuários simultâneos por 7 minutos (script infra/k6-load.js, com login); critérios: p95 \< 1 s e erros \< 1%                                                                                         | \[PENDENTE\] registrar resultado e gráficos do CloudWatch     |
| Segurança                 | Tentar acessar a porta 3000 da instância e a 5432 do banco pela internet (devem falhar) e enviar ações sem login (devem ser recusadas)                                                                      | \[PENDENTE\] acesso sem login já verificado; faltam as portas |
| Backup                    | Snapshot manual do RDS e verificação do backup automático (retenção de 7 dias, já configurada)                                                                                                              | \[PENDENTE\] criar o snapshot e registrar                     |

**5.5 Custos**

Valores aproximados, arredondados a partir da tabela pública de preços da AWS para us-east-1; conferir na AWS Pricing Calculator antes de usar como orçamento.

| **Recurso**                           | **Demonstração (implantado)**                                                                           | **Produção (documentado)**                            |
|---------------------------------------|---------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| Computação                            | 1 × t3.micro, cerca de US\$ 0,25 por dia                                                                | 2 × t3.medium, cerca de US\$ 61 por mês               |
| Balanceador de carga                  | cerca de US\$ 0,55 por dia (só ligado nos dias de teste)                                                | cerca de US\$ 20 por mês                              |
| Banco de dados                        | db.t3.micro Single-AZ, cerca de US\$ 0,42 por dia mais armazenamento                                    | Multi-AZ, cerca de US\$ 120 por mês com armazenamento |
| NAT Gateway                           | não utilizado                                                                                           | cerca de US\$ 33 por mês mais tráfego                 |
| S3, Secrets Manager, CloudWatch e WAF | poucos centavos por dia                                                                                 | cerca de US\$ 15 por mês                              |
| Total                                 | cerca de US\$ 1,2 por dia com tudo ligado; gasto registrado em 14/10/2026: cerca de US\$ 5,9 de US\$ 50 | ordem de US\$ 250 por mês                             |

**5.6 Plano de transição**

- **Preparação:** exportar as planilhas atuais para CSV, no formato aceito pela importação;

- **Migração:** importar os dados no sistema e conferir produtos e saldos;

- **Validação:** comparar o estoque do sistema com o das planilhas e corrigir divergências;

- **Consolidação:** passar o controle para o sistema e manter as planilhas somente como arquivo histórico.

**5.7 Operação**

- **Publicar nova versão:** no CloudShell, atualizar o repositório, gerar e enviar o pacote ao S3, criar nova versão do Launch Template e substituir a instância (o Learner Lab bloqueia o comando de instance refresh; a instância é encerrada pelo Auto Scaling e a substituta já nasce com a versão nova);

- **Trocar a senha do administrador:** editar o segredo wm-cloud/admin no Secrets Manager e substituir a instância, pois a senha é lida ao iniciar;

- **Encerrar cada sessão de testes:** apagar o balanceador e parar o banco, que continuam cobrando mesmo com o laboratório parado, e conferir o painel de gastos (atualiza a cada 8 a 12 horas). O DNS do balanceador muda se ele for recriado.

## **6. PRINTS DE TELA**

Capturas do sistema em execução no ambiente de desenvolvimento, com dados de exemplo.

**Tela de estoque atual (alerta de estoque baixo)**


**Tela de novo produto**


**Tela de histórico de movimentações**


**Tela de importação de planilha (CSV)**


**Tela de login**


**Tela de login com credenciais inválidas**


**Tela de fornecedores, com o atalho Editar**


**Tela de edição de fornecedor**


## **7. LINKS**

GitHub: https://github.com/VieiraAllan/WM-Cloud

Sistema em execução (ativo apenas nos dias de teste e apresentação): http://wm-alb-2005134008.us-east-1.elb.amazonaws.com

Usuário: admin. A senha fica guardada no AWS Secrets Manager (segredo wm-cloud/admin) e não é registrada neste documento.

Roteiro de implantação na AWS: docs/roteiro-aws.md no repositório.

## **8. REFERÊNCIAS**

AMAZON WEB SERVICES. AWS Documentation. Disponível em: https://docs.aws.amazon.com/. Acesso em: 14 out. 2026.

EXPRESS. Express: framework web para Node.js. Disponível em: https://expressjs.com/. Acesso em: 14 out. 2026.

GRAFANA LABS. k6 documentation. Disponível em: https://grafana.com/docs/k6/latest/. Acesso em: 14 out. 2026.

NODE.JS. Node.js Documentation. Disponível em: https://nodejs.org/docs/latest/api/. Acesso em: 14 out. 2026.

THE POSTGRESQL GLOBAL DEVELOPMENT GROUP. PostgreSQL Documentation. Disponível em: https://www.postgresql.org/docs/. Acesso em: 14 out. 2026.
