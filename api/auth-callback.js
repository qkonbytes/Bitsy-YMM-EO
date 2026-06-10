const supabase = require('./supabase');
const crypto = require('crypto');

// Verify Shopify HMAC signature
function verifyHmac(query) {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(generatedHmac),
    Buffer.from(hmac)
  );
}

module.exports = async function handler(req, res) {
  const { shop, code, hmac } = req.query;

  if (!shop || !code || !hmac) {
    return res.status(400).send('Missing required parameters');
  }

  // Verify the request is from Shopify
  if (!verifyHmac(req.query)) {
    return res.status(401).send('HMAC verification failed');
  }

  try {
    // Exchange code for access token
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

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.status(400).send('Failed to get access token');
    }

    const access_token = tokenData.access_token;

    // Store session in Supabase
    const { error } = await supabase
      .from('app_sessions')
      .upsert(
        { shop, access_token },
        { onConflict: 'shop' }
      );

    if (error) {
      console.error('Supabase session error:', error);
      throw error;
    }

    console.log(`✅ App installed on ${shop}`);

    // Trigger full product sync in background
    fetch(`${process.env.APP_URL}/api/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, access_token })
    }).catch(err => console.error('Sync trigger error:', err));

    // Redirect to app in Shopify admin
    return res.redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`
    );

  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).send(`Auth error: ${err.message}`);
  }
};