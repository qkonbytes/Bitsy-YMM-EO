const { fullSync } = require('./sync');
const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let shop = req.body?.shop;
  let access_token = req.body?.access_token;

  // If no credentials in body, look up from app_sessions
  if (!shop || !access_token) {
    // Use env variable store domain or get first session
    shop = process.env.SHOPIFY_STORE_DOMAIN;
    
    const { data: session, error } = await supabase
      .from('app_sessions')
      .select('shop, access_token')
      .eq('shop', shop)
      .single();

    if (error || !session) {
      return res.status(401).json({ error: 'No valid session found for ' + shop });
    }

    access_token = session.access_token;
  }

  console.log('Syncing shop:', shop);

  try {
    const result = await fullSync(shop, access_token);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};