const SUPABASE_URL = 'https://urffwytspjtqnpeubmjz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZmZ3eXRzcGp0cW5wZXVibWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MjAxMDMsImV4cCI6MjEwMzM5NjEwM30.8fKCpIxBV3jd3osCQcJSk1MQD6R4jLnHBMNGTtsxGHc';

const makeSelect = document.getElementById('bitsy-make');
const modelSelect = document.getElementById('bitsy-model');
const yearSelect = document.getElementById('bitsy-year');
const searchBtn = document.getElementById('bitsy-search-btn');

const YMM_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + SUPABASE_ANON_KEY
};

async function loadMakes() {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/distinct_makes?select=make',
    { headers: YMM_HEADERS }
  );
  const data = await res.json();
  data.forEach(function(row) {
    const opt = document.createElement('option');
    opt.value = row.make;
    opt.textContent = row.make;
    makeSelect.appendChild(opt);
  });
}

makeSelect.addEventListener('change', async function() {
  const make = makeSelect.value;
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  modelSelect.disabled = true;
  yearSelect.disabled = true;
  searchBtn.disabled = true;

  if (!make) return;

  const res = await fetch(
    SUPABASE_URL + '/rest/v1/distinct_models?select=model&make=eq.' + encodeURIComponent(make),
    { headers: YMM_HEADERS }
  );
  const data = await res.json();
  data.forEach(function(row) {
    const opt = document.createElement('option');
    opt.value = row.model;
    opt.textContent = row.model;
    modelSelect.appendChild(opt);
  });
  modelSelect.disabled = false;
});

modelSelect.addEventListener('change', async function() {
  const make = makeSelect.value;
  const model = modelSelect.value;
  yearSelect.innerHTML = '<option value="">Select Year</option>';
  yearSelect.disabled = true;
  searchBtn.disabled = true;

  if (!model) return;

  const res = await fetch(
    SUPABASE_URL + '/rest/v1/distinct_years?select=year&make=eq.' + encodeURIComponent(make) + '&model=eq.' + encodeURIComponent(model),
    { headers: YMM_HEADERS }
  );
  const data = await res.json();
  data.forEach(function(row) {
    const opt = document.createElement('option');
    opt.value = row.year;
    opt.textContent = row.year;
    yearSelect.appendChild(opt);
  });
  yearSelect.disabled = false;
});

yearSelect.addEventListener('change', function() {
  searchBtn.disabled = !yearSelect.value;
});

searchBtn.addEventListener('click', function() {
  const make = makeSelect.value;
  const model = modelSelect.value;
  const year = yearSelect.value;
  if (make && model && year) {
    window.location.href = '/pages/ymm-results?make=' + encodeURIComponent(make) + '&model=' + encodeURIComponent(model) + '&year=' + encodeURIComponent(year);
  }
});

loadMakes();
