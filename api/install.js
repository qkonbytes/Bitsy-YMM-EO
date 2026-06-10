module.exports = async function handler(req, res) {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const scopes = 'read_products,write_products,read_themes,write_themes';
  const redirectUri = `${process.env.APP_URL}/api/auth-callback`;
  const clientId = process.env.SHOPIFY_API_KEY;
  const nonce = Math.random().toString(36).substring(2, 15);

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  console.log(`Install URL generated for ${shop}`);
  return res.redirect(installUrl);
};