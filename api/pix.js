// POST /api/pix  -> cria uma cobrança PIX na PinguPag e devolve o QR Code / copia e cola.
const { pingupag, onlyDigits, validCpf, readBody } = require('./_pingupag');
const { sendOrder } = require('./_utmify');

// Valores de doação permitidos (em reais). O valor NUNCA é aceito livremente do navegador.
const DONATION_VALUES = [20, 30, 40, 60, 100, 150, 250, 500, 1000, 1500];
const UPSELL = { amount: 2990, description: 'Quadro Nossa Senhora Aparecida' };

const clean = (v, max = 120) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const body = readBody(req);
    const kind = body.kind === 'upsell' ? 'upsell' : 'donation';

    let amount, description;
    if (kind === 'upsell') {
      ({ amount, description } = UPSELL);
    } else {
      const valor = Number(body.valor);
      if (!DONATION_VALUES.includes(valor)) return res.status(400).json({ error: 'Valor de doação inválido.' });
      amount = Math.round(valor * 100);
      description = `Doação Kit Virgem Maria - R$ ${valor},00`;
    }

    const c = body.customer || {};
    const customer = {
      name: clean(c.name, 80),
      email: clean(c.email, 120).toLowerCase(),
      document: onlyDigits(c.document),
      phone: onlyDigits(c.phone),
    };
    if (customer.name.length < 3) return res.status(400).json({ error: 'Informe o nome completo.' });
    if (!/^\S+@\S+\.\S+$/.test(customer.email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (!validCpf(customer.document)) return res.status(400).json({ error: 'CPF inválido.' });
    if (customer.phone.length < 10 || customer.phone.length > 11) return res.status(400).json({ error: 'Informe o telefone com DDD.' });

    const a = body.address || {};
    const address = {
      street: clean(a.street), number: clean(a.number, 10), complement: clean(a.complement, 40),
      neighborhood: clean(a.neighborhood), city: clean(a.city), state: clean(a.state, 2).toUpperCase(),
      zipcode: onlyDigits(a.zipcode).slice(0, 8),
    };

    const t = body.tracking || {};
    const tracking = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'].forEach((k) => {
      if (t[k]) tracking[k] = clean(t[k], 200);
    });

    const reference = `KVM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const payload = { amount, description, reference, source: 'api_externa', customer };
    if (host && !/^localhost|^127\./.test(host)) {
      // Dados de atribuição viajam na URL do webhook (sem banco de dados) para a API de Conversões da Meta.
      const m = body.meta || {};
      const qs = new URLSearchParams();
      if (/^fb\.\d\.\d+\.\d+$/.test(m.fbp || '')) qs.set('fbp', m.fbp);
      if (/^fb\.\d\.\d+\.[\w-]+$/.test(m.fbc || '')) qs.set('fbc', m.fbc);
      const cip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (cip) qs.set('ip', cip);
      if (req.headers['user-agent']) qs.set('ua', String(req.headers['user-agent']).slice(0, 300));
      const q = qs.toString();
      payload.postback_url = `https://${host}/api/webhook${q ? '?' + q : ''}`;
    }
    if (address.zipcode) payload.address = address;
    if (Object.keys(tracking).length) payload.tracking = tracking;

    const r = await pingupag('/gateway/v1/transaction', { method: 'POST', body: JSON.stringify(payload) });
    const d = r.data || {};
    if (!r.ok || !d.qr_code) {
      console.error('PinguPag erro', r.status, JSON.stringify(d).slice(0, 500));
      return res.status(502).json({ error: d.message || d.error || 'Não foi possível gerar o PIX. Tente novamente.' });
    }
    // Utmify: venda criada, aguardando pagamento (não bloqueia o PIX se falhar)
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
    await sendOrder({ reference, status: 'waiting_payment', amount, productName: description, customer, tracking, ip });
    return res.status(200).json({
      transaction_id: d.transaction_id,
      reference,
      qr_code: d.qr_code,
      qr_code_base64: d.qr_code_base64 || null,
      amount: d.amount || amount,
      expires_at: d.expires_at || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.status === 500 ? e.message : 'Erro ao gerar o PIX.' });
  }
};
