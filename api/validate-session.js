const supabase = require('./supabase');

// Middleware to validate shop session
async function validateSession(shop) {
  if (!shop) return null;

  const { data, error } = await supabase
    .from('app_sessions')
    .select('shop, access_token')
    .eq('shop', shop)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = { validateSession };