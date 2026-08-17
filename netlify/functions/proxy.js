// netlify/functions/proxy.js
// This function acts as a secure middleman between your HTML and Google Apps Script.
// The GAS URL and API token are stored as Netlify environment variables — never in the browser.

const GAS_URL   = process.env.GAS_URL;    // Your Apps Script deployment URL
const API_TOKEN = process.env.API_TOKEN;  // Your secret token

// Actions that are allowed through this proxy
const ALLOWED_ACTIONS = [
  'login',
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
  'requestOTP',
  'verifyOTP',
  'updateProfile',
  'uploadPhoto',
  'removePhoto',
  'getDownloads',
];

exports.handler = async function (event) {

  const CORS = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // Support both GET (query params) and POST (JSON body)
  let params = {};
  let action = '';

  if (event.httpMethod === 'POST') {
    try {
      params = JSON.parse(event.body || '{}');
    } catch(e) {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
      };
    }
    action = params.action || '';
  } else if (event.httpMethod === 'GET') {
    params = event.queryStringParameters || {};
    action = params.action || '';
  } else {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Invalid or missing action' }),
    };
  }

  // For POST requests (photo upload) — forward as POST to GAS with JSON body
  if (event.httpMethod === 'POST') {
    try {
      const gasBody = { ...params, token: API_TOKEN };
      const gasResponse = await fetch(GAS_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(gasBody),
        redirect: 'follow',
      });
      const text = await gasResponse.text();
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: text,
      };
    } catch (err) {
      console.error('Proxy POST error:', err);
      return {
        statusCode: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Failed to reach backend' }),
      };
    }
  }

  // GET requests — forward as query string (existing behaviour)
  const forwardParams = new URLSearchParams({ ...params, token: API_TOKEN });

  try {
    const gasResponse = await fetch(`${GAS_URL}?${forwardParams.toString()}`, {
      method  : 'GET',
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
