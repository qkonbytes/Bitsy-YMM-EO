const supabase = require('./supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Get distinct makes that still need linking
    const { data: makeRows, error: makesError } = await supabase
      .rpc('get_unlinked_makes');

    if (makesError) throw makesError;

    const results = [];

    for (const row of makeRows) {
      const make = row.make;
      try {
        const { data, error } = await supabase
          .rpc('link_vehicle_id_for_make', { p_make: make });

        if (error) throw error;
        results.push({ make, linked: data });
        console.log(`Linked ${data} rows for ${make}`);
      } catch (err) {
        results.push({ make, error: err.message });
        console.error(`Failed for ${make}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      results,
      total_linked: results.reduce((sum, r) => sum + (r.linked || 0), 0)
    });

  } catch (err) {
    console.error('Link fitment error:', err);
    return res.status(500).json({ error: err.message });
  }
};