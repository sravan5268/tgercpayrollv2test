// netlify/functions/proxy.js
const GAS_URL   = process.env.GAS_URL;
const API_TOKEN = process.env.API_TOKEN;

const ALLOWED_ACTIONS = [
  'login',
  'getTgercDocs',
  'getEmployees',
  'getConfig',
  'getNotices',
  'getMasterFile',
  'getSheet',
  'getLoginLog',
  'logLogin',
  'submitLeave',
  'changePassword',
  'forwardLeave',
  'forwardLeave2',
  'returnLeave',
  'approveLeave',
  'rejectLeave',
];

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
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
    // ── Step 1: hit GAS — it will 302 redirect ──
    let response = await fetch(gasUrl, {
      method: 'GET',
      redirect: 'manual',   // don't auto-follow — GAS sends an HTML redirect page
    });

    // ── Step 2: follow the Location header manually ──
    if (response.status === 301 || response.status === 302 || response.status === 303) {
      const redirectUrl = response.headers.get('location');
      if (!redirectUrl) throw new Error('GAS redirect had no Location header');
      response = await fetch(redirectUrl, {
        method: 'GET',
        redirect: 'follow',
      });
    }

    const text = await response.text();

    // Guard: if we still got HTML somehow, return a clean error
    if (text.trimStart().startsWith('<')) {
      console.error('GAS returned HTML instead of JSON:', text.slice(0, 200));
      return {
        statusCode: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Backend returned unexpected response. Check GAS deployment.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to reach backend: ' + err.message }),
    };
  }
};
