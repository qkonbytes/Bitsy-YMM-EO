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

  const mapped = products
    .map(mapProduct)
    .filter(p => p.sku && p.sku.trim() !== '');

  if (mapped.length === 0) {
    return { synced: 0, message: 'No products with SKUs found' };
  }

  // Deduplicate by SKU — keep last occurrence
  const skuMap = {};
  mapped.forEach(p => { skuMap[p.sku] = p; });
  const deduped = Object.values(skuMap);
  console.log(`After dedup: ${deduped.length} unique SKUs`);

  const batchSize = 500;
  let totalSynced = 0;

  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    const skus = batch.map(p => p.sku);

    // Get existing rows for this batch
    const { data: existing } = await supabase
      .from('shopify_products')
      .select('id, sku')
      .in('sku', skus);

    // Map SKU to first matching row id
    const existingMap = {};
    (existing || []).forEach(p => {
      if (!existingMap[p.sku]) existingMap[p.sku] = p.id;
    });

    const toInsert = [];
    const toUpdate = [];

    batch.forEach(p => {
      if (existingMap[p.sku]) {
        toUpdate.push({ ...p, id: existingMap[p.sku] });
      } else {
        toInsert.push(p);
      }
    });

    // Insert new products
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('shopify_products')
        .insert(toInsert);
      if (error) console.error('Insert error:', error);
    }

    // Update existing products one by one to target first SKU match
    for (const p of toUpdate) {
      const { id, ...data } = p;
      const { error } = await supabase
        .from('shopify_products')
        .update(data)
        .eq('id', id);
      if (error) console.error('Update error:', error);
    }

    totalSynced += batch.length;
    console.log(`Synced batch ${Math.floor(i / batchSize) + 1}: ${totalSynced}/${deduped.length}`);
  }

  return { synced: totalSynced };
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

  // Deduplicate by SKU
  const skuMap = {};
  mapped.forEach(p => { skuMap[p.sku] = p; });
  const deduped = Object.values(skuMap);

  // Get all existing products from Supabase
  const { data: existing, error: fetchError } = await supabase
    .from('shopify_products')
    .select('id, sku, shopify_product_id, product_title, product_handle, price, image_url');

  if (fetchError) throw fetchError;

  // Map SKU to first matching row
  const existingMap = {};
  (existing || []).forEach(p => {
    if (!existingMap[p.sku]) existingMap[p.sku] = p;
  });

  // Find products that are new or changed
  const toUpdate = [];
  const toInsert = [];

  deduped.forEach(p => {
    const ex = existingMap[p.sku];
    if (!ex) {
      toInsert.push(p);
    } else if (
      ex.shopify_product_id !== p.shopify_product_id ||
      ex.product_title !== p.product_title ||
      ex.product_handle !== p.product_handle ||
      ex.price !== p.price ||
      ex.image_url !== p.image_url
    ) {
      toUpdate.push({ ...p, id: ex.id });
    }
  });

  console.log(`Found ${toInsert.length} new and ${toUpdate.length} changed products`);

  if (toInsert.length === 0 && toUpdate.length === 0) {
    return { updated: 0, message: 'No changes detected' };
  }

  // Insert new products
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from('shopify_products')
      .insert(toInsert);
    if (error) console.error('Insert error:', error);
  }

  // Update changed products
  for (const p of toUpdate) {
    const { id, ...data } = p;
    await supabase
      .from('shopify_products')
      .update(data)
      .eq('id', id);
  }

  return { updated: toInsert.length + toUpdate.length };
}

module.exports = { fullSync, deltaSync };