"""
Gmail API Refresh Token Generator
=================================

This helper script authorizes TaskFlow to send emails via the Gmail REST API
on behalf of your Gmail account.

Instructions:
1. Ensure the Gmail API is enabled in your Google Cloud Console:
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Add http://localhost:8080 to 'Authorized redirect URIs' in your OAuth Client:
   Google Cloud Console -> APIs & Services -> Credentials -> Your OAuth 2.0 Client ID
3. Run this script:
   python generate_gmail_token.py
4. Sign in with the Gmail account you want TaskFlow to send emails from.
5. The script captures the refresh token and automatically saves it to Backend/.env!
"""

import http.server
import os
import socketserver
import urllib.parse
import webbrowser

from dotenv import load_dotenv, set_key
import requests

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:8080"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send"

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from Backend/.env")
    exit(1)

auth_code = None


class OAuthCallbackHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        parsed_url = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed_url.query)

        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"""
                <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #4f46e5;">Authorization Successful!</h2>
                    <p>TaskFlow received your authorization code. You can close this tab and return to your terminal.</p>
                </body>
                </html>
            """)
        else:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"No code received")

    def log_message(self, format, *args):
        # Suppress standard HTTP request logging in terminal
        return


def main():
    print("=" * 65)
    print("  TaskFlow — Gmail API Refresh Token Setup")
    print("=" * 65)
    print("\nBefore proceeding:")
    print("1. Enable the Gmail API in Google Cloud Console:")
    print("   https://console.cloud.google.com/apis/library/gmail.googleapis.com")
    print("2. Ensure http://localhost:8080 is listed in your Authorized redirect URIs:")
    print("   Google Cloud Console -> Credentials -> Web client -> Authorized redirect URIs\n")

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urllib.parse.urlencode({
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": f"openid email profile {GMAIL_SCOPE}",
            "access_type": "offline",  # Request a refresh token
            "prompt": "consent",       # Force consent so Google issues a refresh token
        })
    )

    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    print(f"If the browser doesn't open automatically, visit this URL:\n\n{auth_url}\n")

    print("Waiting for callback on http://localhost:8080...")
    with socketserver.TCPServer(("localhost", 8080), OAuthCallbackHandler) as httpd:
        while not auth_code:
            httpd.handle_request()

    print("\nReceived authorization code! Exchanging for tokens...")

    token_resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        },
        timeout=15,
    )

    token_data = token_resp.json()
    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("access_token")

    if not refresh_token:
        print("\nERROR: Google did not return a refresh_token.")
        print("Response:", token_data)
        print("\nTip: Make sure you chose 'prompt=consent' or signed into an account with access.")
        return

    # Fetch user info to discover sender email address
    userinfo_resp = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    user_email = userinfo_resp.json().get("email", "")

    print("\n" + "=" * 65)
    print(" SUCCESS! Gmail API Authorization Complete")
    print("=" * 65)
    print(f"Sender Email  : {user_email}")
    print(f"Refresh Token : {refresh_token[:15]}...{refresh_token[-6:]}")

    # Write to Backend/.env
    set_key(ENV_PATH, "GMAIL_SENDER_EMAIL", user_email)
    set_key(ENV_PATH, "GMAIL_REFRESH_TOKEN", refresh_token)
    print(f"\nSaved GMAIL_SENDER_EMAIL and GMAIL_REFRESH_TOKEN directly into {ENV_PATH}!")
    print("TaskFlow is now ready to send live notification emails.")


if __name__ == "__main__":
    main()

