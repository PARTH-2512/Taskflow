"""
Application factory.
Import and register every blueprint and extension here.
"""

from flask import Flask
from flask_cors import CORS

from .config import Config
from .db import close_db
from .oauth import init_oauth
from .errors import register_error_handlers
from .auth import auth_bp


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Allow the Next.js dev server to send cookies to this API.
    # In production, set FRONTEND_URL to the deployed Vercel URL.
    CORS(
        app,
        origins=[app.config["FRONTEND_URL"]],
        supports_credentials=True,
    )

    # Extensions
    init_oauth(app)

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix="/auth")

    # Teardown: close the DB connection at the end of each request
    app.teardown_appcontext(close_db)

    # Uniform JSON error responses
    register_error_handlers(app)

    return app

