import {useState, useEffect} from 'preact/hooks';

const VERCEL_URL = 'https://bitsy-ymm-eo.vercel.app';
const SUPABASE_URL = 'https://mpvhnycxwntslepogfuc.supabase.co';
const SUPABASE_ANON_KEY = 'your-publishable-key-here';

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFitments: null,
    uniqueModels: null,
    uniqueMakes: null,
    totalProducts: null,
    syncedProducts: null,
    universalProducts: null,
  });
  const [lastSync, setLastSync] = useState(null);
  const [nextSync, setNextSync] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    await Promise.all([
      checkApiStatus(),
      loadStats(),
      loadSyncInfo(),
    ]);
    setLoading(false);
  }

  async function checkApiStatus() {
    try {
      const res = await fetch(`${VERCEL_URL}/api/health`);
      const data = await res.json();
      setApiStatus(data.status ? 'online' : 'offline');
    } catch {
      setApiStatus('offline');
    }
  }

  async function loadStats() {
    try {
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'count=exact'
      };

      // Total fitments
      const fitRes = await fetch(
        `${SUPABASE_URL}/rest/v1/fitment?select=id`,
        { headers: { ...headers } }
      );
      const fitCount = fitRes.headers.get('content-range')?.split('/')[1];

      // Unique makes
      const makesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/distinct_makes?select=make`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const makesData = await makesRes.json();

      // Unique models
      const modelsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/distinct_models?select=model`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const modelsData = await modelsRes.json();

      // Total shopify products
      const prodRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shopify_products?select=id`,
        { headers: { ...headers } }
      );
      const prodCount = prodRes.headers.get('content-range')?.split('/')[1];

      // Synced products (has shopify_product_id)
      const syncedRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shopify_products?shopify_product_id=not.is.null&select=id`,
        { headers: { ...headers } }
      );
      const syncedCount = syncedRes.headers.get('content-range')?.split('/')[1];

      // Universal products
      const uniRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shopify_products?is_universal=eq.true&select=id`,
        { headers: { ...headers } }
      );
      const uniCount = uniRes.headers.get('content-range')?.split('/')[1];

      setStats({
        totalFitments: fitCount || '0',
        uniqueMakes: makesData.length || '0',
        uniqueModels: modelsData.length || '0',
        totalProducts: prodCount || '0',
        syncedProducts: syncedCount || '0',
        universalProducts: uniCount || '0',
      });

    } catch (err) {
      console.error('Stats error:', err);
    }
  }

  async function loadSyncInfo() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/shopify_products?select=synced_at&order=synced_at.desc&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      const data = await res.json();
      if (data.length > 0 && data[0].synced_at) {
        const last = new Date(data[0].synced_at);
        setLastSync(last.toLocaleString());
        // Next sync is 2 hours after last sync
        const next = new Date(last.getTime() + 2 * 60 * 60 * 1000);
        setNextSync(next.toLocaleString());
      } else {
        setLastSync('Never synced');
        setNextSync('Pending first sync');
      }
    } catch (err) {
      setLastSync('Unknown');
      setNextSync('Unknown');
    }
  }

  async function forceSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`${VERCEL_URL}/api/trigger-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`✅ Sync complete — ${data.synced || data.updated} products synced`);
        await loadDashboard();
      } else {
        setSyncMessage(`❌ Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage(`❌ Sync failed: ${err.message}`);
    }
    setSyncing(false);
  }

  const statCards = [
    { label: 'Total Fitment Records', value: stats.totalFitments, color: '#4f46e5' },
    { label: 'Vehicle Makes', value: stats.uniqueMakes, color: '#0891b2' },
    { label: 'Vehicle Models', value: stats.uniqueModels, color: '#0891b2' },
    { label: 'Total Products', value: stats.totalProducts, color: '#059669' },
    { label: 'Synced Products', value: stats.syncedProducts, color: '#059669' },
    { label: 'Universal Products', value: stats.universalProducts, color: '#d97706' },
  ];

  return (
    <s-page heading="Bitsy YMM Dashboard">

      {/* API Status Banner */}
      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text>API Status:</s-text>
          <s-badge tone={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'attention' : 'critical'}>
            {apiStatus === 'online' ? '🟢 Online' : apiStatus === 'checking' ? '🟡 Checking...' : '🔴 Offline'}
          </s-badge>
          <s-button variant="plain" onClick={loadDashboard}>
            Refresh
          </s-button>
        </s-stack>
      </s-section>

      {/* Stats Grid */}
      <s-section heading="Database Stats">
        {loading ? (
          <s-spinner />
        ) : (
          <s-grid columns="3" gap="base">
            {statCards.map(card => (
              <s-box
                key={card.label}
                padding="base"
                borderRadius="base"
                borderWidth="base"
                borderColor="base"
              >
                <s-stack gap="tight">
                  <s-text tone="subdued">{card.label}</s-text>
                  <s-heading>
                    {card.value ?? '—'}
                  </s-heading>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        )}
      </s-section>

      {/* Sync Info */}
      <s-section heading="Shopify Product Sync">
        <s-stack gap="base">
          <s-stack direction="inline" gap="loose">
            <s-stack gap="tight">
              <s-text tone="subdued">Last Sync</s-text>
              <s-text>{lastSync || '—'}</s-text>
            </s-stack>
            <s-stack gap="tight">
              <s-text tone="subdued">Next Scheduled Sync</s-text>
              <s-text>{nextSync || '—'}</s-text>
            </s-stack>
          </s-stack>

          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              variant="primary"
              onClick={forceSync}
              loading={syncing}
            >
              {syncing ? 'Syncing...' : 'Force Sync Now'}
            </s-button>
            {syncMessage && (
              <s-text>{syncMessage}</s-text>
            )}
          </s-stack>

          <s-text tone="subdued">
            Products are automatically synced every 2 hours. 
            The sync uses SKU to detect changes and only updates 
            products that have been modified.
          </s-text>
        </s-stack>
      </s-section>

      {/* Quick Links */}
      <s-section heading="Quick Links">
        <s-stack direction="inline" gap="base">
          <s-button
            variant="plain"
            href="https://supabase.com/dashboard"
            target="_blank"
          >
            Supabase Dashboard
          </s-button>
          <s-button
            variant="plain"
            href="https://vercel.com/dashboard"
            target="_blank"
          >
            Vercel Dashboard
          </s-button>
          <s-button
            variant="plain"
            href={`${VERCEL_URL}/api/health`}
            target="_blank"
          >
            API Health Check
          </s-button>
        </s-stack>
      </s-section>

    </s-page>
  );
}