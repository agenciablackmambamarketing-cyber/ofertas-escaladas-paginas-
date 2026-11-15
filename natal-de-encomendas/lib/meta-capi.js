const crypto = require('crypto');

const GRAPH_VERSION = 'v26.0';
const DEFAULT_PIXEL_ID = '1128907580042803';

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeEmail(raw) {
  if (raw == null) return '';
  const email = String(raw).trim().toLowerCase();
  return email.indexOf('@') === -1 ? '' : email;
}

function normalizePhone(raw) {
  if (raw == null) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.indexOf('00') === 0) digits = digits.slice(2);
  if ((digits.length === 10 || digits.length === 11) && digits.indexOf('55') !== 0) {
    digits = '55' + digits;
  }
  return digits;
}

function headerValue(req, name) {
  if (!req || !req.headers) return '';
  const lower = name.toLowerCase();
  const value = req.headers[lower] || req.headers[name] || '';
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function clientIp(req) {
  const forwarded = headerValue(req, 'x-forwarded-for');
  const first = forwarded.split(',')[0].trim();
  return first || headerValue(req, 'x-real-ip');
}

function testEventCode(req) {
  return headerValue(req, 'meta-test-event-code') || headerValue(req, 'x-meta-test-event-code') || process.env.META_TEST_EVENT_CODE || '';
}

function pixelId() {
  return process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;
}

function centsToReais(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim().replace(',', '.');
  if (!text) return null;
  if (text.indexOf('.') !== -1) {
    const decimal = Number(text);
    return Number.isFinite(decimal) ? decimal : null;
  }
  const cents = Number(text);
  if (!Number.isFinite(cents)) return null;
  return cents / 100;
}

function purchaseEventId(transactionId) {
  return 'purchase_' + String(transactionId);
}

function readSale(body) {
  const source = body && body.data && (body.data.transaction_id || body.data.id) ? body.data : body || {};
  const status = source.status || body.status || body.event || '';
  const id = source.id || source.transaction_id || (body.data && body.data.transaction_id) || '';
  const customer = source.customer || {};
  const tracking = source.tracking || {};
  return {
    id: id ? String(id) : '',
    status: String(status || '').toLowerCase(),
    amount: source.amount != null ? source.amount : source.value,
    currency: source.currency || 'BRL',
    email: customer.email || source.email || '',
    phone: customer.phone || source.phone || '',
    fbp: tracking.fbp || source.fbp || '',
    fbc: tracking.fbc || source.fbc || '',
    clientIp: source.user_ip || source.ip || (customer.location && customer.location.ip) || '',
    userAgent: source.user_agent || source.client_user_agent || '',
  };
}

function buildInitiateCheckout(input, req) {
  const eventId = input && input.event_id ? String(input.event_id) : '';
  const userData = {};
  const ip = clientIp(req);
  const ua = (input && input.user_agent) || headerValue(req, 'user-agent');
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (input && input.fbp) userData.fbp = String(input.fbp);
  if (input && input.fbc) userData.fbc = String(input.fbc);
  const event = {
    event_name: 'InitiateCheckout',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
    custom_data: { value: 27, currency: 'BRL' },
  };
  if (input && input.event_source_url) event.event_source_url = String(input.event_source_url);
  const payload = { data: [event] };
  const code = testEventCode(req);
  if (code) payload.test_event_code = code;
  return payload;
}

function buildPurchase(body, req) {
  const sale = readSale(body);
  const value = centsToReais(sale.amount);
  const userData = {};
  const email = normalizeEmail(sale.email);
  const phone = normalizePhone(sale.phone);
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  const ip = sale.clientIp || clientIp(req);
  const ua = sale.userAgent || headerValue(req, 'user-agent');
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (sale.fbp) userData.fbp = String(sale.fbp);
  if (sale.fbc) userData.fbc = String(sale.fbc);
  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: purchaseEventId(sale.id),
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value: value == null ? 27 : value,
      currency: String(sale.currency || 'BRL').toUpperCase(),
    },
  };
  const payload = { data: [event] };
  const code = testEventCode(req);
  if (code) payload.test_event_code = code;
  return { sale: sale, payload: payload };
}

async function sendEvents(payload) {
  const token = process.env.META_CAPI_TOKEN || '';
  if (!token) return { sent: false, reason: 'no-token' };
  const body = new URLSearchParams();
  body.set('data', JSON.stringify(payload.data));
  body.set('access_token', token);
  if (payload.test_event_code) body.set('test_event_code', payload.test_event_code);
  const response = await fetch('https://graph.facebook.com/' + GRAPH_VERSION + '/' + encodeURIComponent(pixelId()) + '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return { sent: true, status: response.status };
}

function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = typeof req.body === 'string' ? req.body : req.body ? String(req.body) : '';
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

module.exports = {
  GRAPH_VERSION: GRAPH_VERSION,
  DEFAULT_PIXEL_ID: DEFAULT_PIXEL_ID,
  timingSafeEqual: timingSafeEqual,
  sha256: sha256,
  normalizeEmail: normalizeEmail,
  normalizePhone: normalizePhone,
  centsToReais: centsToReais,
  purchaseEventId: purchaseEventId,
  readSale: readSale,
  buildInitiateCheckout: buildInitiateCheckout,
  buildPurchase: buildPurchase,
  sendEvents: sendEvents,
  testEventCode: testEventCode,
  clientIp: clientIp,
  readJson: readJson,
  pixelId: pixelId,
};
