const { fullSync } = require('./sync');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shop, access_token } = req.body;

  if (!shop || !access_token) {
    return res.status(400).json({ error: 'Missing shop or access_token' });
  }

  try {
    const result = await fullSync(shop, access_token);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};