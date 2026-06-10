const { fullSync, deltaSync } = require('./sync');
const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all sessions from Supabase
    const { data: sessions, error } = await supabase
      .from('app_sessions')
      .select('shop, access_token');

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return res.status(400).json({ error: 'No store sessions found' });
    }

    const results = [];
    for (const session of sessions) {
      const result = await deltaSync(session.shop, session.access_token);
      results.push({ shop: session.shop, ...result });
    }

    return res.status(200).json({ success: true, results, synced: results.reduce((a, r) => a + (r.updated || 0), 0) });

  } catch (err) {
    console.error('Trigger sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};