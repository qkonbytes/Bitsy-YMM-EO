import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM fitment")
print("Fitment rows:", cur.fetchone()[0])
conn.close()