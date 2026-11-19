// Meta Conversions API (servidor). Envia "Purchase" mesmo que o cliente pague e não volte ao site.
// event_id = "purchase-<reference>" é IGUAL ao eventID do pixel no navegador -> a Meta deduplica (conta 1 vez).
const crypto = require('crypto');
const PIXEL_ID = process.env.META_PIXEL_ID || '1875906393596468';
const GRAPH = process.env.META_GRAPH_URL || 'https://graph.facebook.com/v21.0';

const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
const digits = (v) => String(v || '').replace(/\D/g, '');

async function sendPurchase({ reference, amount, productName, customer, address, fbp, fbc, ip, ua, sourceUrl, eventTime }) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return { skipped: true };
  const parts = String(customer.name || '').trim().split(/\s+/);
  const phone = digits(customer.phone);
  const user = {
    em: customer.email ? [sha(customer.email)] : undefined,
    ph: phone ? [sha(phone.startsWith('55') ? phone : '55' + phone)] : undefined,
    fn: parts[0] ? [sha(parts[0])] : undefined,
    ln: parts.length > 1 ? [sha(parts[parts.length - 1])] : undefined,
    external_id: customer.document ? [sha(digits(customer.document))] : undefined,
    country: [sha('br')],
    ct: address && address.city ? [sha(address.city)] : undefined,
    st: address && address.state ? [sha(address.state)] : undefined,
    zp: address && address.zipcode ? [sha(digits(address.zipcode))] : undefined,
    fbp: fbp || undefined, fbc: fbc || undefined,
    client_ip_address: ip || undefined, client_user_agent: ua || undefined,
  };
  Object.keys(user).forEach((k) => user[k] === undefined && delete user[k]);
  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor((eventTime || new Date()).getTime() / 1000),
      event_id: 'purchase-' + reference,
      action_source: 'website',
      event_source_url: sourceUrl || undefined,
      user_data: user,
      custom_data: { value: amount / 100, currency: 'BRL', content_type: 'product', content_name: productName, num_items: 1 },
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${GRAPH}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal,
    });
    clearTimeout(to);
    if (!res.ok) console.error('Meta CAPI erro', res.status, (await res.text()).slice(0, 300));
    return { ok: res.ok };
  } catch (e) {
    console.error('Meta CAPI falha', e.message);
    return { ok: false };
  }
}
module.exports = { sendPurchase };
