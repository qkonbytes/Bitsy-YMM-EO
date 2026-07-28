import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (_req) => {
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Load all vehicles into memory (only 15k rows)
    const { data: vehicles } = await supabase
      .from('vehicle')
      .select('id, make, model, year')

    if (!vehicles || vehicles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Vehicle table is empty' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Load all shopify_products into memory (only 14k rows)
    const { data: products } = await supabase
      .from('shopify_products')
      .select('id, sku, shopify_product_id')

    // Build lookup maps
    const vehicleMap: Record<string, string> = {}
    vehicles.forEach(v => {
      vehicleMap[`${v.make}|${v.model}|${v.year}`] = v.id
    })

    const productMap: Record<string, { id: string, shopify_product_id: string }> = {}
    products?.forEach(p => {
      if (p.sku) productMap[p.sku] = { id: p.id, shopify_product_id: p.shopify_product_id }
    })

    console.log(`Loaded ${vehicles.length} vehicles and ${products?.length} products into memory`)

    let totalVehicleLinked = 0
    let totalProductLinked = 0
    let offset = 0
    const batchSize = 50000

    while (true) {
      // Fetch batch of unlinked fitment rows
      const { data: rows, error } = await supabase
        .from('fitment')
        .select('id, make, model, year, sku, vehicle_id, product_id')
        .or('vehicle_id.is.null,product_id.is.null')
        .range(offset, offset + batchSize - 1)

      if (error) {
        console.error('Fetch error:', error)
        break
      }

      if (!rows || rows.length === 0) break

      // Match in memory
      const vehicleUpdates: { id: string, vehicle_id: string }[] = []
      const productUpdates: { id: string, product_id: string, shopify_product_id: string }[] = []

      for (const row of rows) {
        if (!row.vehicle_id) {
          const vid = vehicleMap[`${row.make}|${row.model}|${row.year}`]
          if (vid) vehicleUpdates.push({ id: row.id, vehicle_id: vid })
        }
        if (!row.product_id && row.sku) {
          const prod = productMap[row.sku]
          if (prod) productUpdates.push({ 
            id: row.id, 
            product_id: prod.id,
            shopify_product_id: prod.shopify_product_id
          })
        }
      }

      // Write vehicle updates in chunks of 1000
      for (let i = 0; i < vehicleUpdates.length; i += 1000) {
        const chunk = vehicleUpdates.slice(i, i + 1000)
        await supabase.from('fitment').upsert(chunk, { onConflict: 'id' })
        totalVehicleLinked += chunk.length
      }

      // Write product updates in chunks of 1000
      for (let i = 0; i < productUpdates.length; i += 1000) {
        const chunk = productUpdates.slice(i, i + 1000)
        await supabase.from('fitment').upsert(chunk, { onConflict: 'id' })
        totalProductLinked += chunk.length
      }

      console.log(`Processed offset ${offset}: vehicle_linked=${totalVehicleLinked} product_linked=${totalProductLinked}`)
      offset += batchSize

      if (rows.length < batchSize) break
    }

    // Get final counts
    const { count: linkedVehicle } = await supabase
      .from('fitment')
      .select('*', { count: 'exact', head: true })
      .not('vehicle_id', 'is', null)

    const { count: linkedProduct } = await supabase
      .from('fitment')
      .select('*', { count: 'exact', head: true })
      .not('product_id', 'is', null)

    const { count: total } = await supabase
      .from('fitment')
      .select('*', { count: 'exact', head: true })

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_fitment_rows: total,
          vehicle_linked_this_run: totalVehicleLinked,
          product_linked_this_run: totalProductLinked,
          vehicle_linked_total: linkedVehicle,
          product_linked_total: linkedProduct,
          vehicle_unlinked: (total || 0) - (linkedVehicle || 0),
          product_unlinked: (total || 0) - (linkedProduct || 0)
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})