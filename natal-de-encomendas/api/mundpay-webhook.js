const capi = require('../lib/meta-capi');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const secret = process.env.MUNDPAY_WEBHOOK_SECRET || '';
  if (!secret) {
    res.status(503).end();
    return;
  }
  let provided = req.query && req.query.token != null ? String(req.query.token) : '';
  if (!provided && req.url) {
    try {
      provided = new URL(req.url, 'https://local').searchParams.get('token') || '';
    } catch (err) {
      provided = '';
    }
  }
  if (!provided || !capi.timingSafeEqual(provided, secret)) {
    res.status(401).end();
    return;
  }
  const body = capi.readJson(req);
  const built = capi.buildPurchase(body, req);
  const sale = built.sale;
  if (!sale.id || sale.status !== 'paid') {
    if (sale.id) console.log(JSON.stringify({ transaction_id: sale.id, status: sale.status || 'ignored' }));
    res.status(204).end();
    return;
  }
  console.log(JSON.stringify({ transaction_id: sale.id, status: sale.status }));
  if (!process.env.META_CAPI_TOKEN) {
    res.status(204).end();
    return;
  }
  try {
    await capi.sendEvents(built.payload);
  } catch (err) {
    res.status(502).end();
    return;
  }
  res.status(200).json({ ok: true, event_id: built.payload.data[0].event_id });
};
