const supabase = require('./supabase');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { shop, token } = req.body;

  if (!shop || !token) {
    return res.status(400).json({ error: 'Missing shop or token' });
  }

  try {
    // Verify the session token
    const [header, payload, signature] = token.split('.');
    const message = `${header}.${payload}`;
    const expectedSig = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(message)
      .digest('base64url');

    if (expectedSig !== signature) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    // Decode payload
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Store session
    const { error } = await supabase
      .from('app_sessions')
      .upsert(
        { 
          shop, 
          access_token: token,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'shop' }
      );

    if (error) throw error;

    return res.status(200).json({ success: true, shop: decoded.dest });

  } catch (err) {
    console.error('Session error:', err);
    return res.status(500).json({ error: err.message });
  }
};