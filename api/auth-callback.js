const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  const { shop, code } = req.query;

  if (!shop || !code) {
    return res.status(400).json({ error: 'Missing shop or code' });
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

    const { access_token } = await tokenRes.json();

    // Store in Supabase
    const { error } = await supabase
      .from('app_sessions')
      .upsert({ shop, access_token }, { onConflict: 'shop' });

    if (error) throw error;

    // Trigger full sync on install
    await fetch(`${process.env.APP_URL}/api/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, access_token })
    });

    // Redirect to Shopify admin
    return res.redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`
    );

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message });
  }
};