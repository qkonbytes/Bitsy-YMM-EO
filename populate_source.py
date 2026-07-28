import psycopg2
from dotenv import load_dotenv
import os
import time

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

BRAND_TABLES = [
    'Racetech'
]

BATCH_SIZE = 500
SLEEP_BETWEEN = 0.3


def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SET statement_timeout TO '30s'")
    conn.commit()
    return conn, cur


def main():
    total_updated = 0
    total_skipped = 0
    run_start = time.time()

    for table in BRAND_TABLES:
        print(f'\n{"="*55}')
        print(f'TABLE: {table}')
        print(f'{"="*55}')

        table_updated = 0
        table_skipped = 0
        offset = 0
        batch_num = 0

        # Get total count
        try:
            conn, cur = get_connection()
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            total_rows = cur.fetchone()[0]
            cur.close()
            conn.close()
            print(f'Rows in source table: {total_rows}')
        except Exception as e:
            print(f'ERROR getting count for {table}: {e}')
            continue

        while True:
            batch_num += 1
            conn = None

            try:
                conn, cur = get_connection()

                # Fetch batch from brand table
                cur.execute(f"""
                    SELECT id, part_number, make, model, year::text
                    FROM "{table}"
                    ORDER BY id
                    LIMIT %s OFFSET %s
                """, (BATCH_SIZE, offset))

                rows = cur.fetchall()

                if not rows:
                    break

                batch_updated = 0
                batch_skipped = 0

                for row in rows:
                    brand_id   = row[0]  # id from brand table -> goes into source_id
                    sku        = row[1]  # part_number -> matches fitment.sku
                    make       = row[2]
                    model      = row[3]
                    year       = str(row[4]) if row[4] is not None else None

                    # Skip row if key fields are missing
                    if not sku or not make or not model or not year:
                        batch_skipped += 1
                        continue

                    # Find matching fitment row and write source_table + source_id
                    cur.execute("""
                        UPDATE fitment
                        SET source_table = %s,
                            source_id = %s
                        WHERE sku = %s
                        AND make = %s
                        AND model = %s
                        AND year = %s
                    """, (table, brand_id, sku, make, model, year))

                    batch_updated += cur.rowcount

                conn.commit()
                cur.close()
                conn.close()

                table_updated += batch_updated
                table_skipped += batch_skipped
                total_updated += batch_updated
                total_skipped += batch_skipped
                offset += BATCH_SIZE

                pct = min(100, round(offset / total_rows * 100, 1)) if total_rows > 0 else 0
                status = f'Batch {batch_num} [{pct}%] | Updated: {batch_updated} | Skipped: {batch_skipped} | Total: {table_updated}'
                print(f'  ✅ {status}')

                time.sleep(SLEEP_BETWEEN)

                if len(rows) < BATCH_SIZE:
                    break

            except Exception as e:
                print(f'  ❌ Batch {batch_num} FAILED: {e}')
                if conn:
                    try:
                        conn.rollback()
                        conn.close()
                    except:
                        pass
                offset += BATCH_SIZE
                time.sleep(2)

        print(f'\n  {table} DONE: {table_updated} updated, {table_skipped} skipped')

    elapsed = time.time() - run_start
    print(f'\n{"="*55}')
    print(f'ALL TABLES COMPLETE')
    print(f'Total updated : {total_updated}')
    print(f'Total skipped : {total_skipped}')
    print(f'Time elapsed  : {elapsed:.1f}s')
    print(f'{"="*55}')


if __name__ == '__main__':
    main()