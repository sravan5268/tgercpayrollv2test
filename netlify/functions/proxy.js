// netlify/functions/proxy.js
const GAS_URL   = process.env.GAS_URL;
const API_TOKEN = process.env.API_TOKEN;

const ALLOWED_ACTIONS = [
  'login', 'getTgercDocs', 'getEmployees', 'getConfig', 'getNotices',
  'getMasterFile', 'getSheet', 'getLoginLog', 'logLogin', 'submitLeave',
  'changePassword', 'forwardLeave', 'forwardLeave2', 'returnLeave',
  'approveLeave', 'rejectLeave',
];

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const params = event.queryStringParameters || {};
  const action = params.action || '';

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid or missing action' }),
    };
  }

  const forwardParams = new URLSearchParams({ ...params, token: API_TOKEN });
  const gasUrl = `${GAS_URL}?${forwardParams.toString()}`;

  try {
    // ── Attempt 1: redirect follow ──
    const r1 = await fetch(gasUrl, { method: 'GET', redirect: 'follow' });
    const t1  = await r1.text();

    // Log full diagnostics to Netlify function logs
    console.log('=== GAS DIAGNOSTIC ===');
    console.log('GAS_URL set:', !!GAS_URL);
    console.log('API_TOKEN set:', !!API_TOKEN);
    console.log('Action:', action);
    console.log('Final URL (token redacted):', gasUrl.replace(API_TOKEN, 'REDACTED'));
    console.log('Response status:', r1.status);
    console.log('Response headers:', JSON.stringify([...r1.headers.entries()]));
    console.log('Body (first 500 chars):', t1.slice(0, 500));
    console.log('======================');

    // Return diagnostics as JSON so you can see them in the browser too
    if (t1.trimStart().startsWith('<')) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          debug: {
            gas_url_set:   !!GAS_URL,
            token_set:     !!API_TOKEN,
            action,
            http_status:   r1.status,
            response_headers: Object.fromEntries(r1.headers.entries()),
            body_preview:  t1.slice(0, 500),
          },
          error: 'GAS returned HTML — see debug object for details',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: t1,
    };

  } catch (err) {
    console.error('Proxy fetch error:', err);
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
