const assert = require('assert');
const capi = require('../lib/meta-capi');
const capiIc = require('../api/capi-ic');
const webhook = require('../api/mundpay-webhook');

function mockRes() {
  const res = { statusCode: 0, body: undefined };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.end = function (body) {
    res.body = body;
    return res;
  };
  res.json = function (body) {
    res.body = body;
    return res;
  };
  return res;
}

async function run(name, fn) {
  try {
    await fn();
    console.log('PASS ' + name);
  } catch (err) {
    console.error('FAIL ' + name + ' — ' + err.message);
    process.exitCode = 1;
  }
}

(async function () {
  await run('initiate payload uses value 27 BRL and the given event id', function () {
    const payload = capi.buildInitiateCheckout({
      event_id: 'ic_abc',
      event_source_url: 'https://lp.example/?fbclid=1',
      fbp: 'fb.1.1.1',
      fbc: 'fb.1.2.abc',
      user_agent: 'Agent',
    }, { headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' } });
    const event = payload.data[0];
    assert.strictEqual(event.event_name, 'InitiateCheckout');
    assert.strictEqual(event.event_id, 'ic_abc');
    assert.strictEqual(event.action_source, 'website');
    assert.strictEqual(event.custom_data.value, 27);
    assert.strictEqual(event.custom_data.currency, 'BRL');
    assert.strictEqual(event.user_data.client_ip_address, '203.0.113.8');
    assert.strictEqual(event.user_data.fbp, 'fb.1.1.1');
    assert.strictEqual(event.user_data.fbc, 'fb.1.2.abc');
  });

  await run('capi-ic without token is inert 204', async function () {
    delete process.env.META_CAPI_TOKEN;
    let called = false;
    const original = global.fetch;
    global.fetch = async function () { called = true; return { status: 200 }; };
    const res = mockRes();
    await capiIc({ method: 'POST', body: { event_id: 'ic_1' }, headers: {} }, res);
    global.fetch = original;
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(called, false);
  });

  await run('capi-ic posts the Graph payload when the token exists', async function () {
    process.env.META_CAPI_TOKEN = 'secret-token';
    process.env.META_PIXEL_ID = '1128907580042803';
    delete process.env.META_TEST_EVENT_CODE;
    let seen = null;
    const original = global.fetch;
    global.fetch = async function (url, options) {
      seen = { url: url, body: options.body };
      return { status: 200 };
    };
    const res = mockRes();
    await capiIc({
      method: 'POST',
      body: { event_id: 'ic_live', event_source_url: 'https://lp.example/', user_agent: 'UA' },
      headers: { 'user-agent': 'UA', 'x-forwarded-for': '198.51.100.4' },
    }, res);
    global.fetch = original;
    delete process.env.META_CAPI_TOKEN;
    assert.strictEqual(res.statusCode, 204);
    assert.ok(seen.url.indexOf('https://graph.facebook.com/v26.0/1128907580042803/events') === 0);
    assert.ok(seen.url.indexOf('secret-token') === -1);
    const params = new URLSearchParams(seen.body);
    assert.strictEqual(params.get('access_token'), 'secret-token');
    const data = JSON.parse(params.get('data'));
    assert.strictEqual(data[0].event_id, 'ic_live');
    assert.strictEqual(data[0].custom_data.value, 27);
    assert.strictEqual(data[0].user_data.client_ip_address, '198.51.100.4');
  });

  await run('test beacon without a test code does not call Graph', async function () {
    process.env.META_CAPI_TOKEN = 'secret-token';
    delete process.env.META_TEST_EVENT_CODE;
    let called = false;
    const original = global.fetch;
    global.fetch = async function () { called = true; return { status: 200 }; };
    const res = mockRes();
    await capiIc({ method: 'POST', body: { event_id: 'ic_t', test: true }, headers: {} }, res);
    global.fetch = original;
    delete process.env.META_CAPI_TOKEN;
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(called, false);
  });

  await run('webhook without secret is 503 and does not send', async function () {
    delete process.env.MUNDPAY_WEBHOOK_SECRET;
    delete process.env.META_CAPI_TOKEN;
    let called = false;
    const original = global.fetch;
    global.fetch = async function () { called = true; return { status: 200 }; };
    const res = mockRes();
    await webhook({ method: 'POST', query: { token: 'x' }, body: { id: 'tx', status: 'paid', amount: '2700' }, headers: {} }, res);
    global.fetch = original;
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(called, false);
  });

  await run('webhook with the wrong secret is 401', async function () {
    process.env.MUNDPAY_WEBHOOK_SECRET = 'right-secret';
    const res = mockRes();
    await webhook({ method: 'POST', query: { token: 'wrong' }, body: { id: 'tx', status: 'paid' }, headers: {} }, res);
    delete process.env.MUNDPAY_WEBHOOK_SECRET;
    assert.strictEqual(res.statusCode, 401);
  });

  await run('unpaid sale is ignored', async function () {
    process.env.MUNDPAY_WEBHOOK_SECRET = 'right-secret';
    process.env.META_CAPI_TOKEN = 'secret-token';
    let called = false;
    const original = global.fetch;
    global.fetch = async function () { called = true; return { status: 200 }; };
    const res = mockRes();
    await webhook({
      method: 'POST',
      query: { token: 'right-secret' },
      body: { id: 'tx-wait', status: 'awaiting_payment', amount: '2700', currency: 'BRL' },
      headers: {},
    }, res);
    global.fetch = original;
    delete process.env.MUNDPAY_WEBHOOK_SECRET;
    delete process.env.META_CAPI_TOKEN;
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(called, false);
  });

  await run('the same sale id always builds the same Purchase event_id', async function () {
    process.env.MUNDPAY_WEBHOOK_SECRET = 'right-secret';
    process.env.META_CAPI_TOKEN = 'secret-token';
    const bodies = [];
    const original = global.fetch;
    global.fetch = async function (url, options) {
      bodies.push(options.body);
      return { status: 200 };
    };
    const sale = {
      id: '01961ff2-dc9a-71b8-a390-90c0d1de7b4b',
      status: 'paid',
      amount: '2700',
      currency: 'BRL',
      customer: { email: ' Ana@Example.com ', phone: '+55 (11) 98888-7777' },
    };
    for (let i = 0; i < 2; i++) {
      const res = mockRes();
      await webhook({ method: 'POST', query: { token: 'right-secret' }, body: sale, headers: { 'x-forwarded-for': '192.0.2.9' } }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.event_id, 'purchase_01961ff2-dc9a-71b8-a390-90c0d1de7b4b');
    }
    global.fetch = original;
    delete process.env.MUNDPAY_WEBHOOK_SECRET;
    delete process.env.META_CAPI_TOKEN;
    const first = JSON.parse(new URLSearchParams(bodies[0]).get('data'))[0];
    const second = JSON.parse(new URLSearchParams(bodies[1]).get('data'))[0];
    assert.strictEqual(first.event_id, second.event_id);
    assert.strictEqual(first.event_name, 'Purchase');
    assert.strictEqual(first.custom_data.value, 27);
    assert.strictEqual(first.custom_data.currency, 'BRL');
    assert.strictEqual(first.user_data.em[0], capi.sha256('ana@example.com'));
    assert.strictEqual(first.user_data.ph[0], capi.sha256('5511988887777'));
    assert.ok(!JSON.stringify(bodies[0]).includes('Ana@Example.com'));
  });

  if (process.exitCode) process.exit(process.exitCode);
  console.log('all endpoint checks passed');
})();
