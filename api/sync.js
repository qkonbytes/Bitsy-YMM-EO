const supabase = require('./supabase');

// Fetch all products from Shopify with pagination
async function fetchAllShopifyProducts(shop, accessToken) {
  let products = [];
  let url = `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,variants,images`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    products = products.concat(data.products || []);

    // Check for next page in Link header
    const linkHeader = res.headers.get('Link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = match ? match[1] : null;
    } else {
      url = null;
    }
  }

  return products;
}

// Map Shopify product to Supabase row
function mapProduct(product) {
  const variant = product.variants?.[0];
  const image = product.images?.[0];

  return {
    sku: variant?.sku || null,
    shopify_product_id: String(product.id),
    shopify_variant_id: String(variant?.id || ''),
    product_title: product.title,
    product_handle: product.handle,
    price: variant?.price || null,
    image_url: image?.src || null,
    is_universal: false,
    synced_at: new Date().toISOString()
  };
}

// Full sync — used on install and manual trigger
async function fullSync(shop, accessToken) {
  console.log(`Starting full sync for ${shop}`);

  const products = await fetchAllShopifyProducts(shop, accessToken);
  console.log(`Fetched ${products.length} products from Shopify`);

  // Filter out products with no SKU
  const mapped = products
    .map(mapProduct)
    .filter(p => p.sku && p.sku.trim() !== '');

  if (mapped.length === 0) {
    return { synced: 0, message: 'No products with SKUs found' };
  }

  // Upsert all products into Supabase using SKU as the key
  const { error } = await supabase
    .from('shopify_products')
    .upsert(mapped, { onConflict: 'sku' });

  if (error) {
    console.error('Supabase upsert error:', error);
    throw error;
  }

  console.log(`Synced ${mapped.length} products`);
  return { synced: mapped.length };
}

// Delta sync — checks for changes every 2 hours
async function deltaSync(shop, accessToken) {
  console.log(`Starting delta sync for ${shop}`);

  const products = await fetchAllShopifyProducts(shop, accessToken);

  const mapped = products
    .map(mapProduct)
    .filter(p => p.sku && p.sku.trim() !== '');

  if (mapped.length === 0) {
    return { updated: 0, message: 'No products with SKUs found' };
  }

  // Get all existing products from Supabase
  const { data: existing, error: fetchError } = await supabase
    .from('shopify_products')
    .select('sku, shopify_product_id, product_title, product_handle, price, image_url');

  if (fetchError) throw fetchError;

  // Build lookup map from existing data
  const existingMap = {};
  existing.forEach(p => { existingMap[p.sku] = p; });

  // Find products that are new or changed
  const toUpsert = mapped.filter(p => {
    const ex = existingMap[p.sku];
    if (!ex) return true; // New product
    // Check if any values changed
    return (
      ex.shopify_product_id !== p.shopify_product_id ||
      ex.product_title !== p.product_title ||
      ex.product_handle !== p.product_handle ||
      ex.price !== p.price ||
      ex.image_url !== p.image_url
    );
  });

  console.log(`Found ${toUpsert.length} products to update`);

  if (toUpsert.length === 0) {
    return { updated: 0, message: 'No changes detected' };
  }

  const { error } = await supabase
    .from('shopify_products')
    .upsert(toUpsert, { onConflict: 'sku' });

  if (error) throw error;

  return { updated: toUpsert.length };
}

module.exports = { fullSync, deltaSync };