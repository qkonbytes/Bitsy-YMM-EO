import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MAKES_TO_REMOVE = [
  'Aftermarket Wheels', 'Apex', 'Aprilia', 'Brutanza', 'Bse Buell',
  'Cagiva', 'Cannondale', 'Club Car', 'Cobra', 'Dinli', 'Ducati',
  'Fantic', 'Harley', 'Indian', 'John Deere', 'Hisun', 'KAYO',
  'Kymco', 'Lynx', 'Massey Ferguson', 'Montessa', 'Moto Ski',
  'Moto ski', 'Reiju', 'Moto_Guzzi', 'SSR', 'Segway', 'SUR-RON',
  'Talaria', 'Tgb', 'Timbersled', 'TM', 'Toro', 'Victory'
]

Deno.serve(async (_req) => {
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Drop FK constraint first
  await supabase.rpc('drop_vehicle_fk')

  const results = []

  for (const make of MAKES_TO_REMOVE) {
    try {
      const { error, count } = await supabase
        .from('vehicle')
        .delete({ count: 'exact' })
        .eq('make', make)

      if (error) throw error
      results.push({ make, deleted: count })
      console.log(`Deleted ${count} rows for ${make}`)
    } catch (err) {
      results.push({ make, error: err.message })
    }
  }

  // Re-add FK constraint
  await supabase.rpc('add_vehicle_fk')

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})