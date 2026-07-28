const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Get min and max id in fitment
    const { data: bounds } = await supabase
      .from('fitment')
      .select('id')
      .order('id', { ascending: true })
      .limit(1);

    const { data: maxBounds } = await supabase
      .from('fitment')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (!bounds || !maxBounds) {
      return res.status(400).json({ error: 'Could not get fitment bounds' });
    }

    const minId = bounds[0].id;
    const maxId = maxBounds[0].id;
    const batchSize = 10000;

    console.log(`Processing fitment rows from id ${minId} to ${maxId}`);

    // Load all vehicles into memory for fast lookup
    const { data: vehicles } = await supabase
      .from('vehicle')
      .select('id, make, model, year');

    if (!vehicles || vehicles.length === 0) {
      return res.status(400).json({ error: 'Vehicle table is empty - populate vehicle first' });
    }

    // Build vehicle lookup map
    const vehicleMap = {};
    vehicles.forEach(v => {
      const key = `${v.make}|${v.model}|${v.year}`;
      vehicleMap[key] = v.id;
    });

    console.log(`Loaded ${vehicles.length} vehicles into lookup map`);

    let totalProcessed = 0;
    let totalLinked = 0;
    let currentId = minId;

    while (currentId <= maxId) {
      // Fetch batch of unlinked rows
      const { data: rows, error: fetchError } = await supabase
        .from('fitment')
        .select('id, make, model, year')
        .is('vehicle_id', null)
        .gte('id', currentId)
        .lt('id', currentId + batchSize)
        .limit(batchSize);

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        currentId += batchSize;
        continue;
      }

      if (rows && rows.length > 0) {
        // Match rows to vehicle ids
        const updates = rows
          .map(r => ({
            id: r.id,
            vehicle_id: vehicleMap[`${r.make}|${r.model}|${r.year}`] || null
          }))
          .filter(r => r.vehicle_id !== null);

        // Batch update using upsert
        if (updates.length > 0) {
          const { error: updateError } = await supabase
            .from('fitment')
            .upsert(updates, { onConflict: 'id' });

          if (updateError) {
            console.error('Update error:', updateError);
          } else {
            totalLinked += updates.length;
          }
        }

        totalProcessed += rows.length;
        console.log(`Processed up to id ${currentId + batchSize}: ${totalLinked} linked so far`);
      }

      currentId += batchSize;
    }

    // Get final counts
    const { count: linkedCount } = await supabase
      .from('fitment')
      .select('*', { count: 'exact', head: true })
      .not('vehicle_id', 'is', null);

    const { count: unlinkedCount } = await supabase
      .from('fitment')
      .select('*', { count: 'exact', head: true })
      .is('vehicle_id', null);

    return res.status(200).json({
      success: true,
      summary: {
        total_processed: totalProcessed,
        linked_this_run: totalLinked,
        fitment_linked_total: linkedCount,
        fitment_unlinked_total: unlinkedCount
      }
    });

  } catch (err) {
    console.error('Link fitment error:', err);
    return res.status(500).json({ error: err.message });
  }
};