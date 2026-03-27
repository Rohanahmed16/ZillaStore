"""
seed.py — Populate the database with sample data for development.

Run:  python seed.py
This will create zilla.db (if it doesn't exist), apply the schema,
and insert sample sections, subcategories, products, and one offer.
"""

import os
import sys

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from database import get_db, init_db, execute_db, query_db


def seed():
    """Insert sample data into every table."""
    app = create_app()

    with app.app_context():
        init_db()
        db = get_db()

        # ── Check if already seeded ──────────────────────────
        existing = query_db("SELECT COUNT(*) as c FROM products", one=True)
        if existing and existing["c"] > 0:
            print("Database already seeded. Skipping.")
            return

        # ── Subcategories for Bags (section_id=1) ────────────
        bag_subcats = [
            ("Tote Bags",  "tote-bags",  1),
            ("Handbags",   "handbags",   1),
            ("Backpacks",  "backpacks",  1),
            ("Clutches",   "clutches",   1),
        ]
        for name, slug, sid in bag_subcats:
            execute_db(
                "INSERT INTO subcategories (name, slug, section_id) VALUES (?, ?, ?)",
                (name, slug, sid),
            )

        # ── Subcategories for Suits (section_id=2) ───────────
        suit_subcats = [
            ("Formal Suits",  "formal-suits",  2),
            ("Casual Suits",  "casual-suits",  2),
            ("Wedding Suits", "wedding-suits", 2),
            ("Blazers",       "blazers",       2),
        ]
        for name, slug, sid in suit_subcats:
            execute_db(
                "INSERT INTO subcategories (name, slug, section_id) VALUES (?, ?, ?)",
                (name, slug, sid),
            )

        # ── Sample Products — Bags ────────────────────────────
        bag_products = [
            ("Classic Leather Tote",   "classic-leather-tote",   "A spacious leather tote bag perfect for everyday use. Crafted from premium full-grain leather with reinforced stitching.",                                             89.99,  "bag1.jpg",  1, 1, 25, 1, 1),
            ("Urban Canvas Tote",      "urban-canvas-tote",      "Minimalist canvas tote with leather accents. Ideal for work or weekend outings.",                                                                                     49.99,  "bag2.jpg",  1, 1, 40, 1, 0),
            ("Milano Handbag",         "milano-handbag",         "Italian-inspired structured handbag with gold-tone hardware. Features multiple interior compartments.",                                                                 129.99, "bag3.jpg",  1, 2, 15, 1, 1),
            ("Sophia Crossbody",       "sophia-crossbody",       "Elegant crossbody handbag with adjustable strap. Perfect for date nights and formal events.",                                                                          79.99,  "bag4.jpg",  1, 2, 30, 1, 0),
            ("Explorer Backpack",      "explorer-backpack",      "Rugged yet stylish backpack with padded laptop compartment. Water-resistant exterior with YKK zippers.",                                                                99.99,  "bag5.jpg",  1, 3, 35, 1, 1),
            ("Commuter Pro Backpack",  "commuter-pro-backpack",  "Sleek professional backpack with anti-theft back pocket and USB charging port.",                                                                                       119.99, "bag6.jpg",  1, 3, 20, 1, 0),
            ("Velvet Evening Clutch",  "velvet-evening-clutch",  "Luxurious velvet clutch with crystal clasp. The perfect accessory for galas and evening events.",                                                                       59.99,  "bag7.jpg",  1, 4, 50, 1, 1),
            ("Pearl Satin Clutch",     "pearl-satin-clutch",     "Delicate satin clutch adorned with pearl detailing. Comes with a detachable chain strap.",                                                                             69.99,  "bag8.jpg",  1, 4, 18, 1, 0),
        ]
        for name, slug, desc, price, img, sec, sub, stock, active, featured in bag_products:
            execute_db(
                """INSERT INTO products
                   (name, slug, description, price, image, section_id, subcategory_id, stock, is_active, is_featured)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (name, slug, desc, price, img, sec, sub, stock, active, featured),
            )

        # ── Sample Products — Suits ───────────────────────────
        suit_products = [
            ("Executive Charcoal Suit",  "executive-charcoal-suit",  "Tailored two-piece suit in deep charcoal. Made from Italian wool blend with half-canvas construction.",      299.99, "suit1.jpg", 2, 5, 12, 1, 1),
            ("Navy Pinstripe Suit",      "navy-pinstripe-suit",      "Classic navy pinstripe suit with peak lapels. A boardroom essential crafted from Super 120s wool.",           349.99, "suit2.jpg", 2, 5, 8,  1, 0),
            ("Weekend Linen Suit",       "weekend-linen-suit",       "Relaxed-fit linen suit in stone grey. Breathable and perfect for warm-weather events.",                      199.99, "suit3.jpg", 2, 6, 20, 1, 1),
            ("Smart Casual Blazer Set",  "smart-casual-blazer-set",  "Unstructured blazer and chinos set in olive. Versatile enough for brunch or an evening out.",                179.99, "suit4.jpg", 2, 6, 25, 1, 0),
            ("Ivory Wedding Suit",       "ivory-wedding-suit",       "Stunning ivory three-piece wedding suit with satin lapels. Make your special day unforgettable.",            449.99, "suit5.jpg", 2, 7, 5,  1, 1),
            ("Midnight Blue Wedding",    "midnight-blue-wedding",    "Deep midnight blue wedding suit with subtle sheen. Includes vest, trousers, and jacket.",                    399.99, "suit6.jpg", 2, 7, 7,  1, 0),
            ("Modern Slim Blazer",       "modern-slim-blazer",       "Contemporary slim-fit blazer in burgundy. Perfect layered over a roll-neck or crisp shirt.",                 159.99, "suit7.jpg", 2, 8, 30, 1, 1),
            ("Classic Tweed Blazer",     "classic-tweed-blazer",     "Heritage tweed blazer with elbow patches. Timeless British style meets modern tailoring.",                   189.99, "suit8.jpg", 2, 8, 15, 1, 0),
        ]
        for name, slug, desc, price, img, sec, sub, stock, active, featured in suit_products:
            execute_db(
                """INSERT INTO products
                   (name, slug, description, price, image, section_id, subcategory_id, stock, is_active, is_featured)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (name, slug, desc, price, img, sec, sub, stock, active, featured),
            )

        # ── Sample Offer ──────────────────────────────────────
        execute_db(
            """INSERT INTO offers
               (name, discount_type, value, start_date, end_date, is_active, section_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("Spring Sale", "percentage", 15, "2026-03-01", "2026-04-30", 1, 1),
        )
        execute_db(
            """INSERT INTO offers
               (name, discount_type, value, start_date, end_date, is_active, product_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("Wedding Special", "fixed", 50, "2026-03-01", "2026-06-30", 1, 13),
        )

        print("✓ Database seeded successfully with sample data.")


if __name__ == "__main__":
    seed()
