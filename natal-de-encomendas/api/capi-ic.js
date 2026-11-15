const capi = require('../lib/meta-capi');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const input = capi.readJson(req);
  if (!process.env.META_CAPI_TOKEN) {
    res.status(204).end();
    return;
  }
  if (input.test && !capi.testEventCode(req)) {
    res.status(204).end();
    return;
  }
  try {
    await capi.sendEvents(capi.buildInitiateCheckout(input, req));
  } catch (err) {
    res.status(502).end();
    return;
  }
  res.status(204).end();
};
