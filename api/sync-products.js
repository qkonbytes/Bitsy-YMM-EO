const { fullSync } = require('./sync');
const { validateSession } = require('./validate-session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let shop = req.body?.shop;
  let access_token = req.body?.access_token;

  // If no credentials in body, look up from session
  if (!shop || !access_token) {
    const session = await validateSession(shop);
    if (!session) {
      return res.status(401).json({ error: 'No valid session found' });
    }
    access_token = session.access_token;
  }

  try {
    const result = await fullSync(shop, access_token);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};