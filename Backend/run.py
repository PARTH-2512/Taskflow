"""
Entry point for the Flask development server.
Production: use gunicorn — `gunicorn "app:create_app()"`.
"""

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

