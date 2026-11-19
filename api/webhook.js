// POST /api/webhook  <- PinguPag avisa mudanças de status do PIX.
// Não confiamos no corpo: confirmamos o status direto na API da PinguPag antes de avisar a Utmify.
const { pingupag, readBody } = require('./_pingupag');
const { sendOrder, brasiliaToDate } = require('./_utmify');

const STATUS_MAP = { approved: 'paid', refunded: 'refunded', chargeback: 'chargedback', failed: 'refused' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const p = readBody(req);
    const reference = String(p.external_id || p.store_reference || '');
    const txId = String(p.transaction_id || '');
    if (!/^KVM-\d{10,}-[a-z0-9]+$/.test(reference) || !/^[A-Za-z0-9_-]{1,64}$/.test(txId)) return res.status(200).json({ ignored: true });

    // Confirma na PinguPag (evita webhook falso inflando vendas na Utmify)
    const q = await pingupag(`/gateway/v1/query?action=get_transaction&id=${encodeURIComponent(txId)}`);
    const real = q.ok && q.data;
    if (!real || String(real.external_id) !== reference) return res.status(200).json({ ignored: true });

    const status = STATUS_MAP[real.status];
    if (!status) return res.status(200).json({ ignored: true }); // pending/processing/under_review

    const c = p.customer || (real.customer_data && real.customer_data.customer) || {};
    const amount = Number(real.amount) || Number(p.amount);
    const now = new Date();
    await sendOrder({
      reference, status, amount,
      productName: (p.product && p.product.name) || 'Doação Kit Virgem Maria',
      customer: { name: c.name || 'Cliente', email: c.email || 'sem-email@exemplo.com', phone: c.phone, document: c.document },
      tracking: p.tracking || (real.customer_data && real.customer_data.tracking) || {},
      approvedDate: status === 'paid' || status === 'refunded' || status === 'chargedback' ? brasiliaToDate(p.timestamp) : null,
      refundedAt: status === 'refunded' ? now : null,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: false }); // 200 para a PinguPag não reenviar em loop
  }
};
