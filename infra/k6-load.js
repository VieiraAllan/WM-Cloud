// Teste de carga do WM Cloud (k6). Uso:
//   k6 run -e BASE_URL=http://SEU-ALB.us-east-1.elb.amazonaws.com infra/k6-load.js
// Simula ~30 usuários simultâneos consultando estoque e histórico, e registrando movimentações.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL;

export const options = {
  stages: [
    { duration: '1m', target: 30 },   // subida
    { duration: '5m', target: 30 },   // 30 usuários simultâneos
    { duration: '1m', target: 0 },    // descida
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // menos de 1% de erros
    http_req_duration: ['p(95)<1000'],   // 95% das respostas em menos de 1 s
  },
};

export default function () {
  let res = http.get(`${BASE}/`);
  check(res, { 'estoque 200': (r) => r.status === 200 });

  res = http.get(`${BASE}/movements`);
  check(res, { 'historico 200': (r) => r.status === 200 });

  // Entrada seguida de saída do mesmo produto (id 1): o saldo nunca fica negativo.
  const form = { type: 'in', product_id: '1', quantity: '1', note: 'k6' };
  res = http.post(`${BASE}/movements`, form, { redirects: 0 });
  check(res, { 'entrada 302': (r) => r.status === 302 });
  res = http.post(`${BASE}/movements`, { ...form, type: 'out' }, { redirects: 0 });
  check(res, { 'saida 302': (r) => r.status === 302 });

  sleep(1);
}
