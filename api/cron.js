const { deltaSync } = require('./sync');
const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let sessions = [];

    // Try getting sessions from Supabase first
    const { data, error } = await supabase
      .from('app_sessions')
      .select('shop, access_token');

    if (!error && data && data.length > 0) {
      sessions = data;
    } else if (process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN) {
      // Fall back to environment variables
      sessions = [{
        shop: process.env.SHOPIFY_STORE_DOMAIN,
        access_token: process.env.SHOPIFY_ACCESS_TOKEN
      }];
    }

    if (sessions.length === 0) {
      return res.status(400).json({ error: 'No store sessions found' });
    }

    const results = [];
    for (const session of sessions) {
      try {
        const result = await deltaSync(session.shop, session.access_token);
        results.push({ shop: session.shop, ...result });
      } catch (err) {
        results.push({ shop: session.shop, error: err.message });
      }
    }

    return res.status(200).json({ success: true, results });

  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
};