import requests

url = 'https://mpvhnycxwntslepogfuc.supabase.co/rest/v1/rpc/get_fitment_products'
headers = {
    'apikey': 'sb_publishable_shCSxRk-MJJDWblwk9IJwQ_iCwrl3CT',
    'Authorization': 'Bearer sb_publishable_shCSxRk-MJJDWblwk9IJwQ_iCwrl3CT',
    'Content-Type': 'application/json'
}
body = {
    'p_make': 'KTM',
    'p_model': 'EXC 300',
    'p_year': '2019'
}

r = requests.post(url, headers=headers, json=body)
data = r.json()
print('Count:', len(data))
print('First result:', data[0] if data else 'empty')