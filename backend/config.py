"""
config.py — Application configuration for ZILLA Store backend.

Reads from environment variables with sensible defaults so the app
works out-of-the-box locally and can be configured via env vars
on Railway / Render for production deployment.
"""

import os

# Absolute path to the backend directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Absolute path to the frontend directory (sibling to backend)
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))


class Config:
    # -----------------------------------------------------------
    # Flask core
    # -----------------------------------------------------------
    SECRET_KEY = os.environ.get("SECRET_KEY", "zilla-dev-secret-change-me")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = False  # Set to True in production (HTTPS)
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = 30 * 60  # 30 minutes session timeout

    # -----------------------------------------------------------
    # Database — SQLite file lives in the backend folder
    # -----------------------------------------------------------
    DATABASE = os.environ.get("DATABASE_URL", os.path.join(BASE_DIR, "zilla.db"))

    # -----------------------------------------------------------
    # File uploads — stored in backend/uploads, served by Flask
    # -----------------------------------------------------------
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB

    # -----------------------------------------------------------
    # Admin credentials — CHANGE THESE via env vars in production
    # -----------------------------------------------------------
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

    # -----------------------------------------------------------
    # Rate limiting
    # -----------------------------------------------------------
    RATELIMIT_STORAGE_URI = "memory://"

    # -----------------------------------------------------------
    # Frontend directory path
    # -----------------------------------------------------------
    FRONTEND_DIR = FRONTEND_DIR
