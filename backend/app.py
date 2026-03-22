"""
app.py - Main Flask application for ZILLA Store.
Serves frontend HTML and exposes REST API endpoints.
Run: python app.py
"""
import os, uuid, json
from datetime import datetime, date
from functools import wraps
from flask import (Flask, request, jsonify, session, send_from_directory, g)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from werkzeug.utils import secure_filename
from config import Config, FRONTEND_DIR
from database import get_db, close_db, init_db, query_db, execute_db

ALLOWED_EXT = {"png","jpg","jpeg","gif","webp","svg","ico"}

def allowed_file(fn):
    return "." in fn and fn.rsplit(".",1)[1].lower() in ALLOWED_EXT

def create_app():
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    CORS(app, supports_credentials=True)
    limiter = Limiter(key_func=get_remote_address, app=app,
                      storage_uri=app.config["RATELIMIT_STORAGE_URI"], default_limits=[])
    app.teardown_appcontext(close_db)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    def get_sid():
        if "sid" not in session: session["sid"] = str(uuid.uuid4())
        return session["sid"]

    def admin_required(f):
        @wraps(f)
        def dec(*a, **kw):
            if not session.get("admin_logged_in"):
                return jsonify({"error":"Unauthorized"}), 401
            return f(*a, **kw)
        return dec

    def row_to_dict(r): return dict(r) if r else None
    def rows_to_list(rs): return [dict(r) for r in rs]

    def get_offer(pid, sid, scid):
        today = date.today().isoformat()
        offer = query_db("SELECT * FROM offers WHERE is_active=1 AND product_id=? AND start_date<=? AND end_date>=? ORDER BY value DESC LIMIT 1",(pid,today,today),one=True)
        if not offer and scid:
            offer = query_db("SELECT * FROM offers WHERE is_active=1 AND subcategory_id=? AND start_date<=? AND end_date>=? ORDER BY value DESC LIMIT 1",(scid,today,today),one=True)
        if not offer:
            offer = query_db("SELECT * FROM offers WHERE is_active=1 AND section_id=? AND start_date<=? AND end_date>=? ORDER BY value DESC LIMIT 1",(sid,today,today),one=True)
        return dict(offer) if offer else None

    def enrich(p):
        p = dict(p)
        o = get_offer(p["id"], p["section_id"], p["subcategory_id"])
        curr = query_db("SELECT currency FROM site_settings WHERE id=1", one=True)["currency"]
        if o:
            da = round(p["price"]*o["value"]/100,2) if o["discount_type"]=="percentage" else o["value"]
            p["discount_amount"] = min(da, p["price"])
            p["discounted_price"] = round(p["price"]-p["discount_amount"],2)
            p["offer_name"] = o["name"]
            sym = curr or "$"
            p["offer_badge"] = f'{int(o["value"])}% OFF' if o["discount_type"]=="percentage" else f'{sym}{o["value"]} OFF'
        else:
            p["discount_amount"]=0; p["discounted_price"]=p["price"]; p["offer_name"]=None; p["offer_badge"]=None
        return p

    def admin_page_required(f):
        @wraps(f)
        def dec(*a, **kw):
            if not session.get("admin_logged_in"):
                # redirect unauthenticated users to the login page
                from flask import redirect
                return redirect("/admin/login")
            return f(*a, **kw)
        return dec

    # -- Frontend page routes --
    @app.route("/")
    def home(): return send_from_directory(FRONTEND_DIR, "index.html")
    @app.route("/section/<slug>")
    def section_page(slug): return send_from_directory(FRONTEND_DIR, "products.html")
    @app.route("/products")
    def products_page(): return send_from_directory(FRONTEND_DIR, "products.html")
    @app.route("/product/<int:pid>")
    def product_page(pid): return send_from_directory(FRONTEND_DIR, "product.html")
    @app.route("/cart")
    def cart_pg(): return send_from_directory(FRONTEND_DIR, "cart.html")
    @app.route("/checkout")
    def checkout_pg(): return send_from_directory(FRONTEND_DIR, "checkout.html")
    @app.route("/confirmation/<int:oid>")
    def confirm_pg(oid): return send_from_directory(FRONTEND_DIR, "confirmation.html")

    @app.route("/admin")
    @app.route("/admin/login")
    def adm_login():
        if session.get("admin_logged_in"):
            from flask import redirect
            return redirect("/admin/dashboard")
        return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "login.html")

    @app.route("/admin/dashboard")
    @admin_page_required
    def adm_dash(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "dashboard.html")

    @app.route("/admin/products")
    @admin_page_required
    def adm_prod(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "products.html")

    @app.route("/admin/categories")
    @admin_page_required
    def adm_cat(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "categories.html")

    @app.route("/admin/offers")
    @admin_page_required
    def adm_off(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "offers.html")

    @app.route("/admin/settings")
    @admin_page_required
    def adm_set(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "settings.html")

    @app.route("/admin/orders")
    @admin_page_required
    def adm_ord(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "orders.html")

    @app.route("/admin/users")
    @admin_page_required
    def adm_users_page(): return send_from_directory(os.path.join(FRONTEND_DIR,"admin"), "users.html")

    # -- Static assets --
    @app.route("/css/<path:fn>")
    def css(fn): return send_from_directory(os.path.join(FRONTEND_DIR,"css"), fn)
    @app.route("/js/<path:fn>")
    def js(fn): return send_from_directory(os.path.join(FRONTEND_DIR,"js"), fn)
    @app.route("/images/<path:fn>")
    def imgs(fn): return send_from_directory(os.path.join(FRONTEND_DIR,"images"), fn)
    @app.route("/uploads/<path:fn>")
    def uploads(fn): return send_from_directory(app.config["UPLOAD_FOLDER"], fn)

    @app.errorhandler(404)
    def e404(e):
        if request.path.startswith("/api/"): return jsonify({"error":"Not found"}),404
        return send_from_directory(FRONTEND_DIR, "404.html"), 404

    # ===== PUBLIC API =====
    @app.route("/api/settings")
    @limiter.limit("60/minute")
    def api_settings():
        return jsonify(row_to_dict(query_db("SELECT * FROM site_settings WHERE id=1",one=True)))

    @app.route("/api/sections")
    @limiter.limit("60/minute")
    def api_sections():
        return jsonify(rows_to_list(query_db("SELECT * FROM sections ORDER BY id")))

    @app.route("/api/categories")
    @limiter.limit("60/minute")
    def api_categories():
        secs = query_db("SELECT * FROM sections ORDER BY id")
        r = []
        for s in secs:
            d = dict(s)
            d["subcategories"] = rows_to_list(query_db("SELECT * FROM subcategories WHERE section_id=? ORDER BY name",(s["id"],)))
            r.append(d)
        return jsonify(r)

    @app.route("/api/products")
    @limiter.limit("60/minute")
    def api_products():
        q = "SELECT * FROM products WHERE is_active=1"; p = []
        sec = request.args.get("section")
        if sec:
            s = query_db("SELECT id FROM sections WHERE slug=?",(sec,),one=True)
            if s: q+=" AND section_id=?"; p.append(s["id"])
        scid = request.args.get("subcategory_id")
        if scid: q+=" AND subcategory_id=?"; p.append(int(scid))
        if request.args.get("featured")=="1": q+=" AND is_featured=1"
        q+=" ORDER BY created_at DESC"
        return jsonify([enrich(pr) for pr in query_db(q, p)])

    @app.route("/api/products/<int:pid>")
    @limiter.limit("60/minute")
    def api_product(pid):
        pr = query_db("SELECT * FROM products WHERE id=?",(pid,),one=True)
        if not pr: return jsonify({"error":"Not found"}),404
        p = enrich(pr)
        sec = query_db("SELECT * FROM sections WHERE id=?",(p["section_id"],),one=True)
        sub = query_db("SELECT * FROM subcategories WHERE id=?",(p["subcategory_id"],),one=True) if p["subcategory_id"] else None
        p["section_name"] = dict(sec)["name"] if sec else None
        p["subcategory_name"] = dict(sub)["name"] if sub else None
        rel = query_db("SELECT * FROM products WHERE subcategory_id=? AND id!=? AND is_active=1 ORDER BY RANDOM() LIMIT 4",(p["subcategory_id"],pid))
        p["related"] = [enrich(r) for r in rel]
        return jsonify(p)

    @app.route("/api/offers/active")
    @limiter.limit("60/minute")
    def api_offers():
        today = date.today().isoformat()
        return jsonify(rows_to_list(query_db("SELECT * FROM offers WHERE is_active=1 AND start_date<=? AND end_date>=?",(today,today))))

    # -- Cart --
    @app.route("/api/cart")
    @limiter.limit("60/minute")
    def api_cart():
        sid = get_sid()
        items = query_db("SELECT ci.id,ci.quantity,ci.product_id,p.name,p.price,p.image,p.section_id,p.subcategory_id,p.stock FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.session_id=?",(sid,))
        cart=[]; sub=0; dtot=0
        for it in items:
            i=dict(it); e=enrich(query_db("SELECT * FROM products WHERE id=?",(i["product_id"],),one=True))
            i["discounted_price"]=e["discounted_price"]; i["discount_amount"]=e["discount_amount"]
            i["offer_name"]=e["offer_name"]; i["offer_badge"]=e["offer_badge"]
            i["line_total"]=round(e["discounted_price"]*i["quantity"],2)
            i["line_discount"]=round(e["discount_amount"]*i["quantity"],2)
            sub+=round(i["price"]*i["quantity"],2); dtot+=i["line_discount"]; cart.append(i)
        return jsonify({"items":cart,"subtotal":round(sub,2),"discount_total":round(dtot,2),"total":round(sub-dtot,2),"item_count":sum(i["quantity"] for i in cart)})

    @app.route("/api/cart/add", methods=["POST"])
    @limiter.limit("60/minute")
    def api_cart_add():
        sid=get_sid(); d=request.get_json(); pid=d.get("product_id"); qty=d.get("quantity",1)
        if not pid: return jsonify({"error":"product_id required"}),400
        if not query_db("SELECT id FROM products WHERE id=? AND is_active=1",(pid,),one=True):
            return jsonify({"error":"Not found"}),404
        ex=query_db("SELECT * FROM cart_items WHERE session_id=? AND product_id=?",(sid,pid),one=True)
        if ex: execute_db("UPDATE cart_items SET quantity=? WHERE id=?",(ex["quantity"]+qty,ex["id"]))
        else: execute_db("INSERT INTO cart_items(session_id,product_id,quantity) VALUES(?,?,?)",(sid,pid,qty))
        return jsonify({"success":True})

    @app.route("/api/cart/<int:iid>", methods=["PUT"])
    @limiter.limit("60/minute")
    def api_cart_update(iid):
        sid=get_sid(); q=request.get_json().get("quantity",1)
        if q<1: execute_db("DELETE FROM cart_items WHERE id=? AND session_id=?",(iid,sid))
        else: execute_db("UPDATE cart_items SET quantity=? WHERE id=? AND session_id=?",(q,iid,sid))
        return jsonify({"success":True})

    @app.route("/api/cart/<int:iid>", methods=["DELETE"])
    @limiter.limit("60/minute")
    def api_cart_del(iid):
        execute_db("DELETE FROM cart_items WHERE id=? AND session_id=?",(iid,get_sid())); return jsonify({"success":True})

    @app.route("/api/cart", methods=["DELETE"])
    @limiter.limit("60/minute")
    def api_cart_clear():
        execute_db("DELETE FROM cart_items WHERE session_id=?",(get_sid(),)); return jsonify({"success":True})

    # -- Checkout --
    @app.route("/api/checkout", methods=["POST"])
    @limiter.limit("10/minute")
    def api_checkout():
        sid=get_sid(); d=request.get_json()
        for f in ["customer_name","email","phone","address"]:
            if not d.get(f,"").strip(): return jsonify({"error":f"{f} required"}),400
        items=query_db("SELECT ci.*,p.name as pname,p.price,p.section_id,p.subcategory_id FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.session_id=?",(sid,))
        if not items: return jsonify({"error":"Cart empty"}),400
        sub=0; dtot=0; oi_data=[]
        for it in items:
            i=dict(it); e=enrich(query_db("SELECT * FROM products WHERE id=?",(i["product_id"],),one=True))
            ls=round(e["price"]*i["quantity"],2); ld=round(e["discount_amount"]*i["quantity"],2)
            sub+=ls; dtot+=ld
            oi_data.append({"pid":i["product_id"],"pname":i["pname"],"price":e["price"],"da":e["discount_amount"],"qty":i["quantity"]})
            execute_db("UPDATE products SET stock=MAX(0,stock-?) WHERE id=?",(i["quantity"],i["product_id"]))
        total=round(sub-dtot,2)
        oid=execute_db("INSERT INTO orders(customer_name,email,phone,address,subtotal,discount_total,total) VALUES(?,?,?,?,?,?,?)",
            (d["customer_name"],d["email"],d["phone"],d["address"],sub,dtot,total))
        for o in oi_data:
            execute_db("INSERT INTO order_items(order_id,product_id,product_name,price,discount_amount,quantity) VALUES(?,?,?,?,?,?)",
                (oid,o["pid"],o["pname"],o["price"],o["da"],o["qty"]))
        execute_db("DELETE FROM cart_items WHERE session_id=?",(sid,))
        return jsonify({"success":True,"order_id":oid})

    # ===== ADMIN API =====
    @app.route("/api/admin/login", methods=["POST"])
    @limiter.limit("10/minute")
    def adm_login_api():
        d=request.get_json()
        un = d.get("username")
        pw = d.get("password")
        if not un or not pw:
            return jsonify({"error":"Username and password required"}), 400
            
        user = query_db("SELECT * FROM admin_users WHERE username=?",(un,),one=True)
        from werkzeug.security import check_password_hash
        if user and check_password_hash(user["password"], pw):
            session["admin_logged_in"] = True
            session["admin_user_id"] = user["id"]
            session["admin_username"] = user["username"]
            return jsonify({"success":True})
        return jsonify({"error":"Invalid credentials"}),401

    @app.route("/api/admin/logout", methods=["POST"])
    def adm_logout():
        session.pop("admin_logged_in",None)
        session.pop("admin_user_id",None)
        session.pop("admin_username",None)
        return jsonify({"success":True})

    @app.route("/api/admin/check")
    def adm_check(): return jsonify({
        "logged_in": bool(session.get("admin_logged_in")),
        "username": session.get("admin_username")
    })

    # Admin Users Management
    @app.route("/api/admin/users")
    @admin_required
    def adm_users():
        return jsonify(rows_to_list(query_db("SELECT id, username, created_at FROM admin_users ORDER BY username")))

    @app.route("/api/admin/users", methods=["POST"])
    @admin_required
    def adm_create_user():
        d=request.get_json()
        un = d.get("username")
        pw = d.get("password")
        if not un or not pw: return jsonify({"error":"Username and password required"}),400
        
        ex = query_db("SELECT id FROM admin_users WHERE username=?",(un,),one=True)
        if ex: return jsonify({"error":"Username already exists"}),400
        
        from werkzeug.security import generate_password_hash
        hashed = generate_password_hash(pw)
        uid = execute_db("INSERT INTO admin_users(username, password) VALUES(?,?)",(un, hashed))
        return jsonify({"success":True, "id":uid}), 201

    @app.route("/api/admin/users/<int:uid>", methods=["DELETE"])
    @admin_required
    def adm_del_user(uid):
        if uid == session.get("admin_user_id"):
            return jsonify({"error":"Cannot delete yourself"}), 400
            
        count = query_db("SELECT COUNT(*) as c FROM admin_users",one=True)["c"]
        if count <= 1:
            return jsonify({"error":"Cannot delete the last admin user"}), 400
            
        execute_db("DELETE FROM admin_users WHERE id=?",(uid,))
        return jsonify({"success":True})

    @app.route("/api/admin/dashboard")
    @admin_required
    def adm_dashboard():
        return jsonify({
            "total_orders":query_db("SELECT COUNT(*) as c FROM orders",one=True)["c"],
            "total_revenue":round(query_db("SELECT COALESCE(SUM(total),0) as s FROM orders",one=True)["s"],2),
            "active_products":query_db("SELECT COUNT(*) as c FROM products WHERE is_active=1",one=True)["c"],
            "low_stock_alerts":query_db("SELECT COUNT(*) as c FROM products WHERE stock<=5 AND is_active=1",one=True)["c"],
            "recent_orders":rows_to_list(query_db("SELECT * FROM orders ORDER BY created_at DESC LIMIT 10"))})

    @app.route("/api/admin/products")
    @admin_required
    def adm_products():
        return jsonify([enrich(p) for p in query_db("SELECT p.*,s.name as section_name,sc.name as subcategory_name FROM products p LEFT JOIN sections s ON p.section_id=s.id LEFT JOIN subcategories sc ON p.subcategory_id=sc.id ORDER BY p.created_at DESC")])

    @app.route("/api/admin/products", methods=["POST"])
    @admin_required
    def adm_create_prod():
        name=request.form.get("name","").strip(); price=request.form.get("price",0)
        desc=request.form.get("description",""); secid=request.form.get("section_id")
        scid=request.form.get("subcategory_id") or None; stock=request.form.get("stock",0)
        ia=request.form.get("is_active","1"); ife=request.form.get("is_featured","0")
        if not name or not secid: return jsonify({"error":"Name and section required"}),400
        slug=name.lower().replace(" ","-").replace("'","")
        img=""
        if "image" in request.files:
            f=request.files["image"]
            if f and f.filename and allowed_file(f.filename):
                ext=f.filename.rsplit(".",1)[1].lower(); img=f"{slug}-{uuid.uuid4().hex[:8]}.{ext}"
                f.save(os.path.join(app.config["UPLOAD_FOLDER"],img))
        pid=execute_db("INSERT INTO products(name,slug,description,price,image,section_id,subcategory_id,stock,is_active,is_featured) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (name,slug,desc,float(price),img,int(secid),int(scid) if scid else None,int(stock),int(ia),int(ife)))
        return jsonify({"success":True,"id":pid}),201

    @app.route("/api/admin/products/<int:pid>", methods=["PUT"])
    @admin_required
    def adm_update_prod(pid):
        name=request.form.get("name","").strip(); slug=name.lower().replace(" ","-").replace("'","")
        if "image" in request.files:
            f=request.files["image"]
            if f and f.filename and allowed_file(f.filename):
                ext=f.filename.rsplit(".",1)[1].lower(); img=f"{slug}-{uuid.uuid4().hex[:8]}.{ext}"
                f.save(os.path.join(app.config["UPLOAD_FOLDER"],img))
                execute_db("UPDATE products SET image=? WHERE id=?",(img,pid))
        execute_db("UPDATE products SET name=?,slug=?,description=?,price=?,section_id=?,subcategory_id=?,stock=?,is_active=?,is_featured=? WHERE id=?",
            (name,slug,request.form.get("description",""),float(request.form.get("price",0)),
             int(request.form.get("section_id")),int(request.form.get("subcategory_id")) if request.form.get("subcategory_id") else None,
             int(request.form.get("stock",0)),int(request.form.get("is_active","1")),int(request.form.get("is_featured","0")),pid))
        return jsonify({"success":True})

    @app.route("/api/admin/products/<int:pid>", methods=["DELETE"])
    @admin_required
    def adm_del_prod(pid): execute_db("DELETE FROM products WHERE id=?",(pid,)); return jsonify({"success":True})

    # Admin categories (Sections & Subcategories)
    @app.route("/api/admin/categories")
    @admin_required
    def adm_cats():
        secs=query_db("SELECT * FROM sections ORDER BY id"); r=[]
        for s in secs:
            d=dict(s); d["subcategories"]=rows_to_list(query_db("SELECT * FROM subcategories WHERE section_id=? ORDER BY name",(s["id"],))); r.append(d)
        return jsonify(r)

    @app.route("/api/admin/sections", methods=["POST"])
    @admin_required
    def adm_create_sec():
        n=request.get_json().get("name","").strip()
        if not n: return jsonify({"error":"Name required"}),400
        sid=execute_db("INSERT INTO sections(name,slug) VALUES(?,?)",(n,n.lower().replace(" ","-")))
        return jsonify({"success":True,"id":sid}),201

    @app.route("/api/admin/sections/<int:sid>", methods=["PUT"])
    @admin_required
    def adm_update_sec(sid):
        n=request.get_json().get("name","").strip()
        if not n: return jsonify({"error":"Name required"}),400
        execute_db("UPDATE sections SET name=?,slug=? WHERE id=?",(n,n.lower().replace(" ","-"),sid))
        return jsonify({"success":True})

    @app.route("/api/admin/sections/<int:sid>", methods=["DELETE"])
    @admin_required
    def adm_del_sec(sid):
        try:
            count = query_db("SELECT COUNT(*) as c FROM products WHERE section_id=?", (sid,), one=True)["c"]
            if count > 0:
                return jsonify({"error": f"Cannot delete: {count} product(s) still belong to this category."}), 400
            execute_db("DELETE FROM sections WHERE id=?", (sid,))
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route("/api/admin/categories", methods=["POST"])
    @admin_required
    def adm_create_cat():
        d=request.get_json(); n=d.get("name","").strip(); sid=d.get("section_id")
        if not n or not sid: return jsonify({"error":"Name and section_id required"}),400
        cid=execute_db("INSERT INTO subcategories(name,slug,section_id) VALUES(?,?,?)",(n,n.lower().replace(" ","-"),int(sid)))
        return jsonify({"success":True,"id":cid}),201

    @app.route("/api/admin/categories/<int:cid>", methods=["PUT"])
    @admin_required
    def adm_update_cat(cid):
        d=request.get_json(); n=d.get("name","").strip()
        if not n: return jsonify({"error":"Name required"}),400
        execute_db("UPDATE subcategories SET name=?,slug=? WHERE id=?",(n,n.lower().replace(" ","-"),cid))
        return jsonify({"success":True})

    @app.route("/api/admin/categories/<int:cid>", methods=["DELETE"])
    @admin_required
    def adm_del_cat(cid):
        try:
            count = query_db("SELECT COUNT(*) as c FROM products WHERE subcategory_id=?", (cid,), one=True)["c"]
            if count > 0:
                return jsonify({"error": f"Cannot delete: {count} product(s) still use this subcategory."}), 400
            execute_db("DELETE FROM subcategories WHERE id=?", (cid,))
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    # Admin offers
    @app.route("/api/admin/offers")
    @admin_required
    def adm_offers(): return jsonify(rows_to_list(query_db("SELECT * FROM offers ORDER BY created_at DESC")))

    @app.route("/api/admin/offers", methods=["POST"])
    @admin_required
    def adm_create_offer():
        d=request.get_json()
        for f in ["name","discount_type","value","start_date","end_date"]:
            if not d.get(f): return jsonify({"error":f"{f} required"}),400
        oid=execute_db("INSERT INTO offers(name,discount_type,value,start_date,end_date,is_active,product_id,subcategory_id,section_id) VALUES(?,?,?,?,?,?,?,?,?)",
            (d["name"],d["discount_type"],float(d["value"]),d["start_date"],d["end_date"],int(d.get("is_active",1)),d.get("product_id") or None,d.get("subcategory_id") or None,d.get("section_id") or None))
        return jsonify({"success":True,"id":oid}),201

    @app.route("/api/admin/offers/<int:oid>", methods=["PUT"])
    @admin_required
    def adm_update_offer(oid):
        d=request.get_json()
        execute_db("UPDATE offers SET name=?,discount_type=?,value=?,start_date=?,end_date=?,is_active=?,product_id=?,subcategory_id=?,section_id=? WHERE id=?",
            (d["name"],d["discount_type"],float(d["value"]),d["start_date"],d["end_date"],int(d.get("is_active",1)),d.get("product_id") or None,d.get("subcategory_id") or None,d.get("section_id") or None,oid))
        return jsonify({"success":True})

    @app.route("/api/admin/offers/<int:oid>", methods=["DELETE"])
    @admin_required
    def adm_del_offer(oid): execute_db("DELETE FROM offers WHERE id=?",(oid,)); return jsonify({"success":True})

    # Admin settings
    @app.route("/api/admin/settings")
    @admin_required
    def adm_settings(): return jsonify(row_to_dict(query_db("SELECT * FROM site_settings WHERE id=1",one=True)))

    @app.route("/api/admin/settings", methods=["PUT"])
    @admin_required
    def adm_update_settings():
        sn=request.form.get("store_name","ZILLA Store"); tl=request.form.get("tagline","")
        pc=request.form.get("primary_color","#F5C518"); sc=request.form.get("secondary_color","#1a1a1a")
        bc=request.form.get("background_color","#ffffff"); tc=request.form.get("text_color","#1a1a1a")
        sk=request.form.get("seo_keywords","")
        curr=request.form.get("currency","$")
        if "logo" in request.files:
            f=request.files["logo"]
            if f and f.filename and allowed_file(f.filename):
                ext=f.filename.rsplit(".",1)[1].lower(); ln=f"logo-{uuid.uuid4().hex[:8]}.{ext}"
                f.save(os.path.join(app.config["UPLOAD_FOLDER"],ln))
                execute_db("UPDATE site_settings SET logo=? WHERE id=1",(ln,))
        if "favicon" in request.files:
            f=request.files["favicon"]
            if f and f.filename and allowed_file(f.filename):
                ext=f.filename.rsplit(".",1)[1].lower(); fn=f"favicon-{uuid.uuid4().hex[:8]}.{ext}"
                f.save(os.path.join(app.config["UPLOAD_FOLDER"],fn))
                execute_db("UPDATE site_settings SET favicon=? WHERE id=1",(fn,))
        execute_db("UPDATE site_settings SET store_name=?,tagline=?,primary_color=?,secondary_color=?,background_color=?,text_color=?,seo_keywords=?,currency=? WHERE id=1",
            (sn,tl,pc,sc,bc,tc,sk,curr))
        return jsonify({"success":True})

    # Admin orders
    @app.route("/api/admin/orders")
    @admin_required
    def adm_orders():
        s=request.args.get("sort","created_at"); d=request.args.get("dir","DESC")
        if s not in ["id","customer_name","email","total","created_at","status"]: s="created_at"
        if d.upper() not in ("ASC","DESC"): d="DESC"
        return jsonify(rows_to_list(query_db(f"SELECT * FROM orders ORDER BY {s} {d}")))

    @app.route("/api/admin/orders/<int:oid>")
    @admin_required
    def adm_order(oid):
        o=query_db("SELECT * FROM orders WHERE id=?",(oid,),one=True)
        if not o: return jsonify({"error":"Not found"}),404
        od=row_to_dict(o); od["items"]=rows_to_list(query_db("SELECT * FROM order_items WHERE order_id=?",(oid,)))
        return jsonify(od)

    @app.route("/api/admin/orders/<int:oid>/status", methods=["PUT"])
    @admin_required
    def adm_order_status(oid):
        st=request.get_json().get("status","pending")
        if st not in ["pending","processing","shipped","delivered","cancelled"]:
            return jsonify({"error":"Invalid status"}),400
        execute_db("UPDATE orders SET status=? WHERE id=?",(st,oid))
        return jsonify({"success":True})

    @app.before_request
    def init():
        init_db()
        # Seed default admin if table is empty
        count = query_db("SELECT COUNT(*) as c FROM admin_users",one=True)["c"]
        if count == 0:
            from werkzeug.security import generate_password_hash
            hashed = generate_password_hash(app.config["ADMIN_PASSWORD"])
            execute_db("INSERT INTO admin_users(username, password) VALUES(?,?)", (app.config["ADMIN_USERNAME"], hashed))

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  ZILLA Store running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=True)
