// Utilitários compartilhados da integração PinguPag (PIX).
// A chave secreta fica SOMENTE no servidor (variável de ambiente PINGUPAG_API_KEY).
const BASE_URL = (process.env.PINGUPAG_BASE_URL || 'https://pagamento-processador.org.ua').replace(/\/+$/, '');

async function pingupag(path, options = {}) {
  const apiKey = process.env.PINGUPAG_API_KEY;
  if (!apiKey) {
    const err = new Error('PINGUPAG_API_KEY não configurada no servidor.');
    err.status = 500;
    throw err;
  }
  const res = await fetch(BASE_URL + path, {
    ...options,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }

function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
    const d = ((sum * 10) % 11) % 10;
    if (d !== Number(cpf[t])) return false;
  }
  return true;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = { pingupag, onlyDigits, validCpf, readBody };
