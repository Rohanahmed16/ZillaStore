"""
database.py — SQLite database initialization and helper utilities.

This module:
  1. Defines the full schema for the ZILLA Store.
  2. Provides get_db() / close_db() helpers for Flask request context.
  3. Exposes init_db() to create tables on first run.
"""

import sqlite3
from flask import g, current_app

# ──────────────────────────────────────────────────────────────
# Schema — executed once via init_db()
# ──────────────────────────────────────────────────────────────

SCHEMA = """
-- Sections: top-level product categories (e.g. Bags, Suits)
CREATE TABLE IF NOT EXISTS sections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    slug        TEXT    NOT NULL UNIQUE
);

-- Subcategories: children of a section (e.g. Tote Bags under Bags)
CREATE TABLE IF NOT EXISTS subcategories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL,
    section_id  INTEGER NOT NULL,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- Products: the items for sale
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER   PRIMARY KEY AUTOINCREMENT,
    name            TEXT      NOT NULL,
    slug            TEXT      NOT NULL,
    description     TEXT      DEFAULT '',
    price           REAL      NOT NULL,
    image           TEXT      DEFAULT '',
    section_id      INTEGER   NOT NULL,
    subcategory_id  INTEGER,
    stock           INTEGER   DEFAULT 0,
    is_active       INTEGER   DEFAULT 1,
    is_featured     INTEGER   DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id)     REFERENCES sections(id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- Offers / Discounts
CREATE TABLE IF NOT EXISTS offers (
    id              INTEGER   PRIMARY KEY AUTOINCREMENT,
    name            TEXT      NOT NULL,
    discount_type   TEXT      NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
    value           REAL      NOT NULL,
    start_date      TEXT      NOT NULL,
    end_date        TEXT      NOT NULL,
    is_active       INTEGER   DEFAULT 1,
    product_id      INTEGER,
    subcategory_id  INTEGER,
    section_id      INTEGER,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)      REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (subcategory_id)  REFERENCES subcategories(id) ON DELETE SET NULL,
    FOREIGN KEY (section_id)      REFERENCES sections(id) ON DELETE SET NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER   PRIMARY KEY AUTOINCREMENT,
    customer_name   TEXT      NOT NULL,
    email           TEXT      NOT NULL,
    phone           TEXT      NOT NULL,
    address         TEXT      NOT NULL,
    subtotal        REAL      NOT NULL,
    discount_total  REAL      DEFAULT 0,
    total           REAL      NOT NULL,
    status          TEXT      DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order line items
CREATE TABLE IF NOT EXISTS order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL,
    product_id      INTEGER NOT NULL,
    product_name    TEXT    NOT NULL,
    price           REAL    NOT NULL,
    discount_amount REAL    DEFAULT 0,
    quantity        INTEGER NOT NULL,
    FOREIGN KEY (order_id)  REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Session-based shopping cart
CREATE TABLE IF NOT EXISTS cart_items (
    id          INTEGER   PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT      NOT NULL,
    product_id  INTEGER   NOT NULL,
    quantity    INTEGER   DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Site settings — single-row configuration table
CREATE TABLE IF NOT EXISTS site_settings (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    store_name       TEXT DEFAULT 'ZILLA Store',
    tagline          TEXT DEFAULT 'Premium Bags & Suits',
    logo             TEXT DEFAULT '',
    favicon          TEXT DEFAULT '',
    primary_color    TEXT DEFAULT '#F5C518',
    secondary_color  TEXT DEFAULT '#1a1a1a',
    background_color TEXT DEFAULT '#ffffff',
    text_color       TEXT DEFAULT '#1a1a1a',
    seo_keywords     TEXT DEFAULT '',
    currency         TEXT DEFAULT '$'
);

-- Admin users table (passwords stored as hashed values)
CREATE TABLE IF NOT EXISTS admin_users (
    id          INTEGER   PRIMARY KEY AUTOINCREMENT,
    username    TEXT      NOT NULL UNIQUE,
    password    TEXT      NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single settings row if it doesn't exist
INSERT OR IGNORE INTO site_settings (id) VALUES (1);
"""

# ──────────────────────────────────────────────────────────────
# Connection helpers
# ──────────────────────────────────────────────────────────────

def get_db():
    """Return a per-request database connection stored on Flask's `g` object."""
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row    # rows behave like dicts
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create all tables defined in SCHEMA if they don't already exist."""
    db = get_db()
    db.executescript(SCHEMA)
    db.commit()

    # Automatic schema upgrades
    try:
        db.execute("ALTER TABLE site_settings ADD COLUMN seo_keywords TEXT DEFAULT ''")
        db.commit()
    except sqlite3.OperationalError:
        pass # Column already exists or table issue


def query_db(query, args=(), one=False):
    """
    Execute a read query and return results as a list of Row objects.
    If `one=True`, return only the first result (or None).
    """
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def execute_db(query, args=()):
    """
    Execute a write query (INSERT/UPDATE/DELETE), commit, and return
    the lastrowid (useful after INSERTs).
    """
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    lastrowid = cur.lastrowid
    cur.close()
    return lastrowid
