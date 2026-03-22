# ZILLA Store 🟡

A fully functional e-commerce store with a **separate frontend** (HTML/CSS/JS) and **backend** (Python/Flask + SQLite).

## Project Structure

```
ZILLA Store/
├── backend/               ← Python Flask API server
│   ├── app.py             ← Main Flask application (all API endpoints)
│   ├── config.py          ← Configuration (env vars, paths)
│   ├── database.py        ← SQLite schema, connection helpers
│   ├── seed.py            ← Sample data seeder
│   ├── requirements.txt   ← Python dependencies
│   └── uploads/           ← Uploaded images (products, logo, etc.)
│
├── frontend/              ← Pure HTML/CSS/JS client
│   ├── index.html         ← Home page
│   ├── bags.html          ← Bags section
│   ├── suits.html         ← Suits section
│   ├── products.html      ← All products
│   ├── product.html       ← Product detail
│   ├── cart.html           ← Shopping cart
│   ├── checkout.html      ← Checkout form
│   ├── confirmation.html  ← Order confirmation
│   ├── 404.html           ← 404 error page
│   ├── css/
│   │   ├── style.css      ← Main stylesheet (all public pages)
│   │   └── admin.css      ← Admin panel styles
│   ├── js/
│   │   ├── api.js         ← API client (all fetch calls)
│   │   ├── app.js         ← Core logic (header, footer, theme, SEO)
│   │   ├── products.js    ← Product listing & filtering
│   │   ├── cart.js        ← Cart page logic
│   │   ├── checkout.js    ← Checkout & validation
│   │   └── admin.js       ← Admin panel logic
│   ├── admin/
│   │   ├── login.html     ← Admin login
│   │   ├── dashboard.html ← Dashboard with stats
│   │   ├── products.html  ← Product CRUD
│   │   ├── categories.html← Category management
│   │   ├── offers.html    ← Offers & discounts
│   │   ├── settings.html  ← Site settings (colors, logo, name)
│   │   └── orders.html    ← Order management
│   └── images/
│       └── placeholder.svg
│
└── README.md              ← This file
```

## Quick Start (Local Setup)

### Prerequisites
- **Python 3.9+** installed
- **pip** package manager

### 1. Clone & Set Up the Virtual Environment

Open a terminal or command prompt in your project folder:
```bash
python -m venv .venv
.venv\Scripts\activate
```

### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Initialize the Database

The database will be automatically initialized when you run the app for the first time. If you want to seed it with demo products, you can run:
```bash
python seed.py
```

### 4. Run the Store

You can run the store using the provided startup scripts. These scripts will automatically boot up your virtual environment, check for missing packages, and start the Flask server.

**On Windows:**
Double-click the **`run.bat`** file, or run it via command line:
```bash
.\run.bat
```

**On Linux / Mac OS:**
Run the **`run.sh`** file from your terminal:
```bash
./run.sh
```

Alternatively, you can start it manually via command line:
```bash
cd backend
python app.py
```
The store will be available at **http://localhost:5000**

### 5. Access the Admin Panel

Navigate to **http://localhost:5000/admin/login**
(Note: we intentionally keep this link hidden from the storefront for security).

Default credentials defined in `config.py` the very first time you boot:
- **Username:** `admin`
- **Password:** `admin123`

Once logged in, you can create new admin accounts from the **Users** tab inside the dashboard.

## Changing Store Name & Colors

1. Log in to the admin panel at `/admin`
2. Go to **Settings**
3. Update the **Store Name**, **Tagline**, and **Colors**
4. Upload a **Logo** and **Favicon**
5. Click **Save Settings**

All changes take effect immediately — no code changes needed.

## Admin User Management

Admin accounts are securely hashed and stored in the SQLite database within the `admin_users` table.
- A default admin account is seeded upon initial runtime based on your `config.py` fallbacks (`ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars).
- Once logged in, you should navigate to the **Users** tab inside the dashboard.
- From there, you can **add, view, and delete** administrative user accounts right from your browser!

You do **not** need to continually define environment variables for administration after the first account has been provisioned.

## Environment Variables

| Variable          | Default          | Description                      |
|-------------------|------------------|----------------------------------|
| `SECRET_KEY`      | `zilla-dev-...`  | Flask session secret key         |
| `DATABASE_URL`    | `backend/zilla.db` | SQLite database file path      |
| `PORT`            | `5000`           | Server port                      |
| `FLASK_DEBUG`     | `1`              | Enable debug mode (set to 0 in prod) |

## Deploying to Railway or Render

### Railway

1. Push your code to a GitHub repository
2. Connect the repo to Railway
3. Set the **Root Directory** to `backend`
4. Set the **Start Command** to: `python app.py`
5. Add environment variables in the Railway dashboard:
   - `SECRET_KEY` — a long random string
   - `FLASK_DEBUG` — `0`
   - `PORT` — Railway sets this automatically

### Render

1. Push your code to GitHub
2. Create a new **Web Service** on Render
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `python app.py`
6. Add environment variables in the Render dashboard (same as above)

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | HTML5, CSS3 (vanilla), JavaScript |
| Backend   | Python 3, Flask                   |
| Database  | SQLite                            |
| Fonts     | Inter (Google Fonts)              |

## Features Checklist

- [x] Home page with hero, featured products, highlights, newsletter
- [x] Bags section with subcategory sidebar & price range filter
- [x] Suits section with subcategory sidebar & price range filter
- [x] All Products page with combined sidebar
- [x] Product detail with gallery, price, discounts, add-to-cart
- [x] Session-based shopping cart
- [x] Checkout with inline validation
- [x] Order confirmation page
- [x] Custom 404 page
- [x] Admin dashboard with stats
- [x] Admin product CRUD
- [x] Admin category management (tabbed)
- [x] Admin offers & discounts
- [x] Admin site settings (name, colors, logo, favicon)
- [x] Admin order management with status updates
- [x] Rate limiting (60/min browsing, 10/min checkout)
- [x] Dynamic SEO meta tags
- [x] Fully responsive (480px, 768px, 1024px, 1280px breakpoints)
- [x] CSS custom properties driven by database settings
- [x] Micro-interactions (hover lifts, transitions, underlines)
