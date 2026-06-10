module.exports = async function handler(req, res) {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const scopes = 'read_products,write_products';
  const redirectUri = `${process.env.APP_URL}/api/auth-callback`;
  const clientId = process.env.SHOPIFY_API_KEY;

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return res.redirect(installUrl);
};