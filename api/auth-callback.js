const supabase = require('./supabase');
const crypto = require('crypto');

function verifyHmac(query) {
  try {
    const params = Object.assign({}, query);
    const hmac = params.hmac;
    delete params.hmac;
    delete params.state;

    const message = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(generatedHmac, 'hex'),
      Buffer.from(hmac, 'hex')
    );
  } catch (err) {
    console.error('HMAC error:', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  console.log('Auth callback query:', JSON.stringify(req.query));

  const { shop, code, hmac } = req.query;

  if (!shop || !code || !hmac) {
    return res.status(400).json({
      error: 'Missing required parameters',
      received: { shop: !!shop, code: !!code, hmac: !!hmac }
    });
  }

  if (!verifyHmac(req.query)) {
    return res.status(401).json({ error: 'HMAC verification failed' });
  }

  try {
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code
        })
      }
    );

    const tokenData = await tokenRes.json();
    console.log('Token response:', JSON.stringify(tokenData));

    if (!tokenData.access_token) {
      return res.status(400).json({
        error: 'Failed to get access token',
        details: tokenData
      });
    }

    const access_token = tokenData.access_token;

    const { error: dbError } = await supabase
      .from('app_sessions')
      .upsert(
        { shop, access_token },
        { onConflict: 'shop' }
      );

    if (dbError) {
      console.error('Supabase error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    console.log('Session stored for:', shop);

    fetch(`${process.env.APP_URL}/api/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, access_token })
    }).catch(err => console.error('Sync error:', err));

    return res.redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`
    );

  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).json({ error: err.message });
  }
};