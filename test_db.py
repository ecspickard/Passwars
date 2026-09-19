import sqlite3
import json
import sys

# Connect to database
conn = sqlite3.connect('passwars.db')
cursor = conn.cursor()

# Get the last user_passwords entry
cursor.execute("SELECT id, secret_value FROM user_passwords ORDER BY id DESC LIMIT 1")
row = cursor.fetchone()
if not row:
    print("No passwords found in DB")
    sys.exit(0)

print(f"ID: {row[0]}, Secret: {row[1]}")

from utils import decrypt_password

try:
    plaintext = decrypt_password(row[1])
    print(f"Plaintext: {plaintext}")
    try:
        data = json.loads(plaintext)
        print(f"JSON parsed: {data}")
    except json.JSONDecodeError:
        print("Not JSON")
except Exception as e:
    print(f"Decrypt failed: {e}")

