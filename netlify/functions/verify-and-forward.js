// netlify/functions/verify-and-forward.js
import fetch from 'node-fetch';

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  // parse incoming form URL-encoded body
  const params = new URLSearchParams(event.body || '');

  // get reCAPTCHA token
  const captchaToken = params.get('g-recaptcha-response');
  if (!captchaToken) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing recaptcha token' }) };
  }

  // verify with Google
  const secret = process.env.RECAPTCHA_SECRET;
  const verifyResp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: \`secret=\${encodeURIComponent(secret)}&response=\${encodeURIComponent(captchaToken)}\`,
  });
  const verifyData = await verifyResp.json();
  if (!verifyData.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Captcha failed', details: verifyData['error-codes'] }),
    };
  }

  // forward everything to Salesforce Web-to-Lead
  const salesforceResp = await fetch(
    'https://webto.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8&orgId=00Dj0000001pL1W',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!salesforceResp.ok) {
    return { statusCode: 502, body: JSON.stringify({ success: false, error: 'Salesforce forwarding failed' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}
