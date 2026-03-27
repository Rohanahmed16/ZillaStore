import sqlite3
import os
db_path = r"c:\Users\Rohan ahmed\Desktop\ZILLA Store\backend\zilla.db"
db = sqlite3.connect(db_path)
try:
    print(db.execute("SELECT * FROM site_settings").fetchone())
    db.execute("ALTER TABLE site_settings ADD COLUMN seo_keywords TEXT DEFAULT ''")
    db.commit()
    print("Column added!")
except Exception as e:
    print(f"Error: {e}")
