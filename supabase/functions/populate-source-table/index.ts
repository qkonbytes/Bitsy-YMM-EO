import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const url = new URL(req.url)
  const tableName = url.searchParams.get('table')

  if (!tableName) {
    return new Response(
      JSON.stringify({ error: 'Missing ?table= parameter' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Load all SKUs from brand table into memory
    let brandSkus: Set<string> = new Set()
    let offset = 0
    const batchSize = 10000

    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('part_number')
        .not('part_number', 'is', null)
        .range(offset, offset + batchSize - 1)

      if (error || !data || data.length === 0) break
      data.forEach(r => brandSkus.add(r.part_number))
      offset += batchSize
      if (data.length < batchSize) break
    }

    console.log(`Loaded ${brandSkus.size} unique SKUs from ${tableName}`)

    // Process fitment rows in batches matching on SKU only
    let totalUpdated = 0
    offset = 0

    while (true) {
      const { data: fitmentRows, error: fitError } = await supabase
        .from('fitment')
        .select('id, sku')
        .is('source_table', null)
        .range(offset, offset + batchSize - 1)

      if (fitError || !fitmentRows || fitmentRows.length === 0) break

      // Match on SKU only
      const toUpdate = fitmentRows
        .filter(r => r.sku && brandSkus.has(r.sku))
        .map(r => ({ id: r.id, source_table: tableName }))

      // Update in chunks of 500
      for (let i = 0; i < toUpdate.length; i += 500) {
        const chunk = toUpdate.slice(i, i + 500)
        await supabase
          .from('fitment')
          .upsert(chunk, { onConflict: 'id' })
        totalUpdated += chunk.length
      }

      console.log(`${tableName}: offset ${offset}, updated ${totalUpdated} so far`)
      offset += batchSize
      if (fitmentRows.length < batchSize) break
    }

    return new Response(
      JSON.stringify({ success: true, table: tableName, updated: totalUpdated }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})