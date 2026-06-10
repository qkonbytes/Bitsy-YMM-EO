const crypto = require('crypto');
const supabase = require('./supabase');

function verifyHmac(query) {
  const params = Object.assign({}, query);
  const hmac = params.hmac;
  delete params.hmac;

  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  console.log('HMAC message:', message);

  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  console.log('Generated:', generatedHmac);
  console.log('Expected:', hmac);
  console.log('Match:', generatedHmac === hmac);

  // Use simple string comparison instead of timingSafeEqual
  return generatedHmac === hmac;
}

module.exports = async function handler(req, res) {
  const { shop, code, hmac } = req.query;

  // Step 1 — No code yet, redirect to Shopify OAuth
  if (!code) {
    if (!shop) return res.status(400).send('Missing shop');
    const scopes = 'read_products,write_products,read_themes,write_themes';
    const redirectUri = `${process.env.APP_URL}/api/install`;
    const nonce = Math.random().toString(36).substring(2, 15);
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
    console.log('Redirecting to:', installUrl);
    return res.redirect(installUrl);
  }

  // Step 2 — Code received, verify HMAC and exchange for token
  if (!hmac) return res.status(400).json({ error: 'Missing hmac' });

  // Log for debugging
  const params = Object.assign({}, req.query);
  delete params.hmac;
  delete params.state;
  delete params.host;
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  console.log('HMAC message:', message);
  console.log('Secret length:', process.env.SHOPIFY_API_SECRET?.length);
  console.log('Secret preview:', process.env.SHOPIFY_API_SECRET?.substring(0, 6));
  console.log('Generated HMAC:', crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(message).digest('hex'));
  console.log('Expected HMAC:', req.query.hmac);

  if (!verifyHmac(req.query)) {
    console.error('HMAC failed');
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
      return res.status(400).json({ error: 'Failed to get token', details: tokenData });
    }

    const { error: dbError } = await supabase
      .from('app_sessions')
      .upsert(
        { shop, access_token: tokenData.access_token },
        { onConflict: 'shop' }
      );

    if (dbError) throw dbError;

    console.log('✅ Token stored for:', shop);

    // Trigger sync in background
    fetch(`${process.env.APP_URL}/api/trigger-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).catch(err => console.error('Sync error:', err));

    return res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
};