const { deltaSync } = require('./sync');
const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  // Verify Vercel cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all installed stores from Supabase
    const { data: sessions, error } = await supabase
      .from('app_sessions')
      .select('shop, access_token');

    if (error) throw error;

    const results = [];

    // Run delta sync for each store
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