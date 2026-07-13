const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Get distinct makes that still need linking
    const { data: makeRows, error: makesError } = await supabase
      .rpc('get_unlinked_makes');

    if (makesError) throw makesError;

    console.log(`Processing ${makeRows.length} makes...`);

    let totalLinked = 0;
    let totalFailed = 0;
    const results = [];

    for (const row of makeRows) {
      const make = row.make;
      try {
        const { data, error } = await supabase
          .rpc('link_vehicle_id_for_make', { p_make: make });

        if (error) throw error;
        totalLinked += data || 0;
        results.push({ make, linked: data || 0 });
        console.log(`${make}: linked ${data} rows`);
      } catch (err) {
        totalFailed++;
        results.push({ make, error: err.message });
        console.error(`Failed for ${make}:`, err.message);
      }
    }

    // Get final counts from fitment
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
        total_linked_this_run: totalLinked,
        makes_processed: makeRows.length,
        makes_failed: totalFailed,
        fitment_linked_total: linkedCount,
        fitment_unlinked_total: