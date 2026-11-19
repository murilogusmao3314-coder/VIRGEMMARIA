// GET /api/status?id=<transaction_id> -> status do PIX (pending | approved | failed ...)
const { pingupag } = require('./_pingupag');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && req.query.id) || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const r = await pingupag(`/gateway/v1/query?action=get_transaction&id=${encodeURIComponent(id)}`);
    if (!r.ok) return res.status(502).json({ error: 'Falha ao consultar o pagamento.' });
    return res.status(200).json({ status: (r.data && r.data.status) || 'pending', reference: (r.data && r.data.external_id) || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao consultar o pagamento.' });
  }
};
