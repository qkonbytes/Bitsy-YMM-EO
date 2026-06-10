const { fullSync, deltaSync } = require('./sync');
const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let sessions = [];

    // Try Supabase first
    const { data, error } = await supabase
      .from('app_sessions')
      .select('shop, access_token');

    if (!error && data && data.length > 0) {
      sessions = data;
    } else if (process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN) {
      // Fall back to env vars
      sessions = [{
        shop: process.env.SHOPIFY_STORE_DOMAIN,
        access_token: process.env.SHOPIFY_ACCESS_TOKEN
      }];
    }

    if (sessions.length === 0) {
      return res.status(400).json({ error: 'No store sessions found' });
    }

    let totalSynced = 0;
    const results = [];

    for (const session of sessions) {
      try {
        const result = await fullSync(session.shop, session.access_token);
        totalSynced += result.synced || 0;
        results.push({ shop: session.shop, ...result });
      } catch (err) {
        results.push({ shop: session.shop, error: err.message });
      }
    }

    return res.status(200).json({ 
      success: true, 
      synced: totalSynced,
      results 
    });

  } catch (err) {
    console.error('Trigger sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};