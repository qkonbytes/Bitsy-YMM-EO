const supabase = require('./supabase');
const crypto = require('crypto');

function verifyHmac(query) {
  try {
    const { hmac, ...rest } = query;
    const message = Object.keys(rest)
      .sort()
      .map(key => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
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
    console.error('HMAC verification error:', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  console.log('Auth callback query:', JSON.stringify(req.query));

  const { shop, code, hmac } = req.query;

  if (!shop || !code || !hmac) {
    console.error('Missing params:', { shop: !!shop, code: !!code, hmac: !!hmac });
    return res.status(400).json({ 
      error: 'Missing required parameters',
      received: { shop: !!shop, code: !!code, hmac: !!hmac }
    });
  }

  // Verify HMAC
  function verifyHmac(query) {
  try {
    const { hmac, ...rest } = query;
    
    // Remove state from verification as Shopify handles it separately
    delete rest.state;
    
    const message = Object.keys(rest)
      .sort()
      .map(key => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
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
    console.error('HMAC verification error:', err);
    return false;
  }
}

module.exports = async function handler(req, res) {
  console.log('Auth callback received:', JSON.stringify(req.query));
  
  const { shop, code, hmac } = req.query;
  
  if (!shop || !code || !hmac) {
    console.error('Missing params:', { shop: !!shop, code: !!code, hmac: !!hmac });
    return res.status(400).json({ 
      error: 'Missing required parameters',
      received: { shop: !!shop, code: !!code, hmac: !!hmac }
    });
  }

  if (!verifyHmac(req.query)) {
    console.error('HMAC failed for query:', JSON.stringify(req.query));
    return res.status(401).json({ error: 'HMAC verification failed' });
  }
  // ... rest of the function

    const tokenData = await tokenRes.json();
    console.log('Token exchange response:', JSON.stringify(tokenData));

    if (!tokenData.access_token) {
      return res.status(400).json({ 
        error: 'Failed to get access token',
        details: tokenData
      });
    }

    const access_token = tokenData.access_token;

    // Store session in Supabase
    const { error: dbError } = await supabase
      .from('app_sessions')
      .upsert(
        { shop, access_token },
        { onConflict: 'shop' }
      );

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw dbError;
    }

    console.log(`✅ Session stored for ${shop}`);

    // Trigger full sync in background
    fetch(`${process.env.APP_URL}/api/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, access_token })
    }).catch(err => console.error('Sync trigger error:', err));

    // Redirect to app
    return res.redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`
    );

  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).json({ error: err.message });
  }
};