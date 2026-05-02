// netlify/functions/proxy.js
// This function acts as a secure middleman between your HTML and Google Apps Script.
// The GAS URL and API token are stored as Netlify environment variables — never in the browser.

const GAS_URL   = process.env.GAS_URL;    // Your Apps Script deployment URL
const API_TOKEN = process.env.API_TOKEN;  // Your secret token

// Actions that are allowed through this proxy
const ALLOWED_ACTIONS = [
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

  // ── CORS headers so your Netlify-hosted HTML can call this function ──
  const CORS = {
    'Access-Control-Allow-Origin': '*',        // tighten to your Netlify domain in production
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // Only GET allowed
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  // Read query params sent by the browser
  const params = event.queryStringParameters || {};
  const action = params.action || '';

  // Validate action is in the allowed list
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid or missing action' }),
    };
  }

  // Build the query string to forward to Apps Script
  // We inject the real token here — the browser never sends or sees it
  const forwardParams = new URLSearchParams({ ...params, token: API_TOKEN });

  try {
    const gasResponse = await fetch(`${GAS_URL}?${forwardParams.toString()}`, {
      method: 'GET',
      redirect: 'follow',
    });

    const text = await gasResponse.text();

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
      body: JSON.stringify({ success: false, error: 'Failed to reach backend' }),
    };
  }
};
