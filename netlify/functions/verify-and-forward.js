// netlify/functions/verify-and-forward.js
module.exports.handler = async function (event, context) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://www.altamiraltd.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  // Ensure secret is available
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({
        success: false,
        error: 'Missing RECAPTCHA_SECRET in environment',
        note: 'If this is a Deploy Preview from a fork, secrets may be blocked; deploy on main or approve the preview.',
      }),
    };
  }

  const params = new URLSearchParams(event.body || '');
  const captchaToken = params.get('g-recaptcha-response');
  if (!captchaToken) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({ success: false, error: 'Missing recaptcha token' }),
    };
  }

  // verify with Google reCAPTCHA
  let verifyData;
  try {
    const verifyResp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'secret=' + encodeURIComponent(secret) + '&response=' + encodeURIComponent(captchaToken),
    });
    verifyData = await verifyResp.json();
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({ success: false, error: 'Captcha verification request failed', detail: err.message }),
    };
  }

  if (!verifyData.success) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({ success: false, error: 'Captcha failed', details: verifyData['error-codes'] }),
    };
  }

  // forward to Salesforce Web-to-Lead
  const salesforceResp = await fetch(
    'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00Dj0000001pL1W',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!salesforceResp.ok) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
      body: JSON.stringify({ success: false, error: 'Salesforce forwarding failed' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://www.altamiraltd.com' },
    body: JSON.stringify({ success: true }),
  };
};
