const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { data: sessions } = await supabase
      .from('app_sessions')
      .select('shop, access_token')
      .limit(1);

    if (!sessions || sessions.length === 0) {
      return res.status(400).json({ error: 'No session found' });
    }

    const { shop, access_token } = sessions[0];
    
    const url = `https://${shop}/admin/api/2024-01/products.json?limit=5&fields=id,title,variants`;
    
    const shopifyRes = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      }
    });

    const data = await shopifyRes.json();

    return res.status(200).json({
      status: shopifyRes.status,
      shop,
      token_preview: access_token.substring(0, 10),
      product_count: data.products?.length,
      products: data.products?.map(p => ({
        id: p.id,
        title: p.title,
        sku: p.variants?.[0]?.sku
      })),
      error: data.errors || null
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};