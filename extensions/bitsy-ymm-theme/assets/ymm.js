const SUPABASE_URL = 'https://mpvhnycxwntslepogfuc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_shCSxRk-MJJDWblwk9IJwQ_iCwrl3CT';

const makeSelect = document.getElementById('bitsy-make');
const modelSelect = document.getElementById('bitsy-model');
const yearSelect = document.getElementById('bitsy-year');
const searchBtn = document.getElementById('bitsy-search-btn');

// Load makes on page load
async function loadMakes() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vehicle?select=make&order=make.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );
  const data = await res.json();
  const makes = [...new Set(data.map(r => r.make))];
  makes.forEach(make => {
    const opt = document.createElement('option');
    opt.value = make;
    opt.textContent = make;
    makeSelect.appendChild(opt);
  });
}

// Load models when make is selected
makeSelect.addEventListener('change', async () => {
  const make = makeSelect.value;
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  modelSelect.disabled = true;
  yearSelect.disabled = true;
  searchBtn.disabled = true;

  if (!make) return;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vehicle?select=model&make=eq.${encodeURIComponent(make)}&order=model.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );
  const data = await res.json();
  const models = [...new Set(data.map(r => r.model))];
  models.forEach(model => {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    modelSelect.appendChild(opt);
  });
  modelSelect.disabled = false;
});

// Load years when model is selected
modelSelect.addEventListener('change', async () => {
  const make = makeSelect.value;
  const model = modelSelect.value;
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  yearSelect.disabled = true;
  searchBtn.disabled = true;

  if (!model) return;

  const res = await fetch(
    `${https://mpvhnycxwntslepogfuc.supabase.co}/rest/v1/vehicle?select=year&make=eq.${encodeURIComponent(make)}&model=eq.${encodeURIComponent(model)}&order=year.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${sb_publishable_shCSxRk-MJJDWblwk9IJwQ_iCwrl3CT}`
      }
    }
  );
  const data = await res.json();
  const years = [...new Set(data.map(r => r.year))];
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });
  yearSelect.disabled = false;
});

// Enable search button when year is selected
yearSelect.addEventListener('change', () => {
  searchBtn.disabled = !yearSelect.value;
});

// Search button click
searchBtn.addEventListener('click', () => {
  const make = makeSelect.value;
  const model = modelSelect.value;
  const year = yearSelect.value;
  if (make && model && year) {
    window.location.href = `/pages/ymm-results?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`;
  }
});

// Init
loadMakes();