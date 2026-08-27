import psycopg2
from dotenv import load_dotenv
import os
import time

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

BATCH_SIZE = 10000
SLEEP = 0.1

def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SET statement_timeout TO 0")
    conn.commit()
    return conn, cur

def main():
    print("Loading vehicle lookup...")
    conn, cur = get_connection()
    cur.execute("SELECT id, make, model, year FROM vehicle")
    vehicles = cur.fetchall()
    vehicle_map = {}
    for v in vehicles:
        key = v[1] + '|' + v[2] + '|' + v[3]
        vehicle_map[key] = v[0]
    print(f"Loaded {len(vehicle_map)} unique vehicle keys")

    print("Loading shopify_products lookup...")
    cur.execute("SELECT id, sku, shopify_product_id FROM shopify_products WHERE sku IS NOT NULL")
    products = cur.fetchall()
    product_map = {}
    for p in products:
        if p[1]:
            product_map[p[1]] = {'id': p[0], 'shopify_product_id': p[2]}
    print(f"Loaded {len(product_map)} unique SKUs")
    cur.close()
    conn.close()

    offset = 0
    total_vehicle = 0
    total_product = 0
    batch_num = 0

    while True:
        batch_num += 1
        conn, cur = get_connection()

        cur.execute("""
            SELECT id, make, model, year, sku
            FROM fitment
            WHERE vehicle_id IS NULL OR product_id IS NULL
            LIMIT %s OFFSET %s
        """, (BATCH_SIZE, offset))

        rows = cur.fetchall()
        if not rows:
            cur.close()
            conn.close()
            break

        vehicle_updates = []
        product_updates = []

        for row in rows:
            fid, make, model, year, sku = row
            key = str(make) + '|' + str(model) + '|' + str(year)
            vid = vehicle_map.get(key)
            if vid:
                vehicle_updates.append((str(vid), str(fid)))
            if sku and sku in product_map:
                prod = product_map[sku]
                product_updates.append((str(prod['id']), str(prod['shopify_product_id']), str(fid)))

        if vehicle_updates:
            cur.executemany("""
                UPDATE fitment SET vehicle_id = %s::uuid WHERE id = %s::uuid
            """, vehicle_updates)
            total_vehicle += len(vehicle_updates)

        if product_updates:
            cur.executemany("""
                UPDATE fitment SET product_id = %s::uuid, shopify_product_id = %s WHERE id = %s::uuid
            """, product_updates)
            total_product += len(product_updates)

        conn.commit()
        cur.close()
        conn.close()

        print(f"Batch {batch_num} | Vehicle: {len(vehicle_updates)} | Product: {len(product_updates)} | Total V: {total_vehicle} | Total P: {total_product}")

        offset += BATCH_SIZE
        time.sleep(SLEEP)

    print(f"\nDONE - Vehicle linked: {total_vehicle} | Product linked: {total_product}")

if __name__ == '__main__':
    main()