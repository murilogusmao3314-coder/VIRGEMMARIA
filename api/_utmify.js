// Envio de vendas para a Utmify: https://docs.utmify.com.br/envio-de-vendas
// Token fica SOMENTE no servidor (variável UTMIFY_API_TOKEN). Sem token, o envio é ignorado.
const UTMIFY_URL = process.env.UTMIFY_BASE_URL || 'https://api.utmify.com.br/api-credentials/orders';
const PLATFORM = 'KitVirgemMaria';
// Taxa da PinguPag: 5,99% + R$ 2,00 por venda (ajustável por variável de ambiente)
const FEE_PERCENT = Number(process.env.GATEWAY_FEE_PERCENT || 5.99);
const FEE_FIXED_CENTS = Number(process.env.GATEWAY_FEE_FIXED_CENTS || 200);
const gatewayFee = (amount) => Math.min(amount, Math.round((amount * FEE_PERCENT) / 100) + FEE_FIXED_CENTS);

const pad = (n) => String(n).padStart(2, '0');
// Date -> "YYYY-MM-DD HH:MM:SS" em UTC
function utc(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// A referência é "KVM-<timestamp_ms>-<rand>": dela sai o createdAt (precisa ser sempre o mesmo em todo update).
function createdFromReference(ref) {
  const m = /^KVM-(\d{10,})-/.exec(String(ref || ''));
  return m ? new Date(Number(m[1])) : new Date();
}

// Webhook da PinguPag manda horário de Brasília (UTC-3) -> converte para UTC.
function brasiliaToDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(str || ''));
  if (!m) return new Date();
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 3, +m[5], +m[6]));
}

const slug = (s) => String(s || 'produto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const nz = (v) => (v ? String(v) : null);

async function sendOrder({ reference, status, amount, productName, customer, tracking, approvedDate, refundedAt, ip }) {
  const token = process.env.UTMIFY_API_TOKEN;
  if (!token) return { skipped: true };
  const t = tracking || {};
  const body = {
    orderId: reference,
    platform: PLATFORM,
    paymentMethod: 'pix',
    status,
    createdAt: utc(createdFromReference(reference)),
    approvedDate: approvedDate ? utc(approvedDate) : null,
    refundedAt: refundedAt ? utc(refundedAt) : null,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: nz(customer.phone),
      document: nz(customer.document),
      country: 'BR',
      ...(ip ? { ip } : {}),
    },
    products: [{ id: slug(productName), name: productName, planId: null, planName: null, quantity: 1, priceInCents: amount }],
    trackingParameters: {
      src: nz(t.src), sck: nz(t.sck), utm_source: nz(t.utm_source), utm_campaign: nz(t.utm_campaign),
      utm_medium: nz(t.utm_medium), utm_content: nz(t.utm_content), utm_term: nz(t.utm_term),
    },
    commission: { totalPriceInCents: amount, gatewayFeeInCents: gatewayFee(amount), userCommissionInCents: amount - gatewayFee(amount), currency: 'BRL' },
  };
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(UTMIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': token },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    clearTimeout(to);
    if (!res.ok) console.error('Utmify erro', res.status, (await res.text()).slice(0, 300));
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('Utmify falha', e.message);
    return { ok: false };
  }
}

module.exports = { sendOrder, brasiliaToDate };
