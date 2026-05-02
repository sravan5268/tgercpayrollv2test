// netlify/functions/proxy.js
const fetch   = require('node-fetch');
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

  if (!GAS_URL || !API_TOKEN) {
    console.error('Missing env vars — GAS_URL:', !!GAS_URL, 'API_TOKEN:', !!API_TOKEN);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Server misconfiguration: missing env vars' }),
    };
  }

  const forwardParams = new URLSearchParams({ ...params, token: API_TOKEN });
  const gasUrl = `${GAS_URL}?${forwardParams.toString()}`;

  try {
    // First fetch — GAS will 302 redirect
    const r1 = await fetch(gasUrl, { redirect: 'manual' });

    let finalResponse;

    if (r1.status === 301 || r1.status === 302 || r1.status === 303) {
      const location = r1.headers.get('location');
      console.log('GAS redirected to:', location);
      if (!location) throw new Error('GAS redirect missing Location header');
      finalResponse = await fetch(location, { redirect: 'follow' });
    } else {
      finalResponse = r1;
    }

    const text = await finalResponse.text();
    console.log('GAS response status:', finalResponse.status);
    console.log('GAS body preview:', text.slice(0, 300));

    if (text.trimStart().startsWith('<')) {
      console.error('GAS returned HTML — likely wrong URL or token');
      return {
        statusCode: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'GAS returned HTML. Check GAS_URL and API_TOKEN env vars, and ensure GAS is deployed as Execute as: Me / Anyone.',
          preview: text.slice(0, 300),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: text,
    };

  } catch (err) {
    console.error('Proxy fetch error:', err.message);
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Proxy fetch failed: ' + err.message }),
    };
  }
};
