"""
Authlib OAuth client.

Using the OpenID Connect discovery document means we never hard-code
Google's endpoint URLs — Authlib fetches them automatically.
"""

from authlib.integrations.flask_client import OAuth

oauth = OAuth()


def init_oauth(app) -> None:
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        # Authlib fetches token/auth endpoints from this document automatically
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={
            "scope": "openid email profile",
            # Request a refresh token so long-lived sessions are possible later
            "prompt": "select_account",
        },
    )

