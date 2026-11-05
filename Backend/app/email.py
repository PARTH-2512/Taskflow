"""
Gmail API Notification Service
==============================

Sends transactional notification emails using the official Gmail REST API
and an OAuth 2.0 refresh token.

Triggered on:
  1. Task Created   → Sent to the Assignee
  2. Task Completed → Sent to the Creator

Why Gmail API instead of raw SMTP?
  - Modern, secure, OAuth 2.0 based (Google deprecated basic auth SMTP).
  - Uses the app Gmail account with a long-lived refresh token.
  - Non-blocking (runs in a background daemon thread so user requests stay fast).
"""

import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import threading
from typing import Optional

from flask import current_app
import requests

logger = logging.getLogger(__name__)


def _get_access_token(client_id: str, client_secret: str, refresh_token: str) -> Optional[str]:
    """Exchange OAuth 2.0 refresh token for a fresh Google access token."""
    try:
        resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=10,
        )
        data = resp.json()
        if "access_token" in data:
            return data["access_token"]
        logger.error(f"[Gmail API] Token refresh failed: {data}")
        return None
    except Exception as e:
        logger.error(f"[Gmail API] Error refreshing access token: {e}")
        return None


def _send_raw_email(
    sender: str,
    recipient: str,
    subject: str,
    html_body: str,
    text_body: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> None:
    """Send an email using Gmail REST API messages.send."""
    access_token = _get_access_token(client_id, client_secret, refresh_token)
    if not access_token:
        logger.warning("[Gmail API] Skipped email delivery: could not obtain access token.")
        return

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"TaskFlow <{sender}>"
    msg["To"] = recipient

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Base64url-encode the RFC 2822 message
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    try:
        response = requests.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"raw": raw_message},
            timeout=10,
        )
        if response.status_code in (200, 201):
            logger.info(f"[Gmail API] Email successfully sent to {recipient} (Subject: {subject})")
        else:
            logger.error(f"[Gmail API] Failed to send email to {recipient}: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"[Gmail API] Exception sending email: {e}")


def _dispatch_email_async(
    sender: str,
    recipient: str,
    subject: str,
    html_body: str,
    text_body: str,
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> None:
    """Spawn a background thread to send the email without blocking the HTTP response."""
    thread = threading.Thread(
        target=_send_raw_email,
        args=(
            sender,
            recipient,
            subject,
            html_body,
            text_body,
            client_id,
            client_secret,
            refresh_token,
        ),
        daemon=True,
    )
    thread.start()


# ── Public Notification Functions ──────────────────────────────────────────


def send_task_created_email(task: dict) -> None:
    """
    Send an email notification to the assignee when a new task is created.
    """
    app = current_app._get_current_object()
    sender = app.config.get("GMAIL_SENDER_EMAIL") or app.config.get("ADMIN_EMAIL")
    refresh_token = app.config.get("GMAIL_REFRESH_TOKEN")
    client_id = app.config.get("GOOGLE_CLIENT_ID")
    client_secret = app.config.get("GOOGLE_CLIENT_SECRET")
    frontend_url = app.config.get("FRONTEND_URL", "http://localhost:3000")

    recipient = task.get("assignee_email")
    if not recipient:
        return

    if not refresh_token:
        print(f"[Gmail Notification Skipped] Task '{task.get('title')}' created for {recipient}. (Set GMAIL_REFRESH_TOKEN in .env to send live emails).")
        return

    priority_names = {1: "Low", 2: "Medium", 3: "High"}
    priority_str = priority_names.get(task.get("priority"), "Medium")
    task_url = f"{frontend_url}/tasks/{task.get('id')}"
    creator_name = task.get("creator_name") or task.get("creator_email") or "Your Manager"

    subject = f"[TaskFlow] New Task Assigned: {task.get('title')}"

    text_body = f"""Hello,

You have been assigned a new task on TaskFlow by {creator_name}.

Title: {task.get('title')}
Priority: {priority_str}
Due Date: {task.get('due_date') or 'No deadline specified'}
Estimated Hours: {task.get('estimated_hours') or 'N/A'} hrs

Description:
{task.get('description') or 'No description provided.'}

View and manage this task:
{task_url}

Best regards,
TaskFlow Team
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 800; color: #4f46e5;">TaskFlow</span>
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 0;">New Task Assigned</h2>
          <p style="font-size: 14px; color: #4b5563;">
            <strong>{creator_name}</strong> has assigned a task to you:
          </p>

          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">{task.get('title')}</h3>
            <p style="margin: 0; font-size: 13px; color: #4b5563;">
              <strong>Priority:</strong> {priority_str} &nbsp;|&nbsp; 
              <strong>Due:</strong> {task.get('due_date') or 'No deadline'} &nbsp;|&nbsp; 
              <strong>Est:</strong> {task.get('estimated_hours') or 'N/A'} hrs
            </p>
            {f'<p style="margin: 12px 0 0 0; font-size: 13px; color: #374151; white-space: pre-wrap;">{task.get("description")}</p>' if task.get("description") else ''}
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <a href="{task_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px;">
              Open Task in TaskFlow &rarr;
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0 16px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            Sent automatically by TaskFlow. Please do not reply directly to this email.
          </p>
        </div>
      </body>
    </html>
    """

    _dispatch_email_async(
        sender=sender,
        recipient=recipient,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        client_id=client_id,
        client_secret=client_secret,
        refresh_token=refresh_token,
    )


def send_task_completed_email(task: dict, completer_name: str) -> None:
    """
    Send an email notification to the creator when an assigned task is marked completed.
    """
    app = current_app._get_current_object()
    sender = app.config.get("GMAIL_SENDER_EMAIL") or app.config.get("ADMIN_EMAIL")
    refresh_token = app.config.get("GMAIL_REFRESH_TOKEN")
    client_id = app.config.get("GOOGLE_CLIENT_ID")
    client_secret = app.config.get("GOOGLE_CLIENT_SECRET")
    frontend_url = app.config.get("FRONTEND_URL", "http://localhost:3000")

    recipient = task.get("creator_email")
    if not recipient:
        return

    if not refresh_token:
        print(f"[Gmail Notification Skipped] Task '{task.get('title')}' completed by {completer_name}. (Set GMAIL_REFRESH_TOKEN in .env to send live emails).")
        return

    task_url = f"{frontend_url}/tasks/{task.get('id')}"
    subject = f"[TaskFlow] Task Completed: {task.get('title')}"

    text_body = f"""Hello,

The task you created on TaskFlow has been marked as completed by {completer_name}.

Title: {task.get('title')}
Completed By: {completer_name}

View completed task:
{task_url}

Best regards,
TaskFlow Team
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 800; color: #4f46e5;">TaskFlow</span>
          </div>
          <div style="display: inline-block; padding: 4px 10px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; color: #047857; font-size: 12px; font-weight: 600; margin-bottom: 12px;">
            ✓ Completed
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 0;">Task Marked as Completed</h2>
          <p style="font-size: 14px; color: #4b5563;">
            <strong>{completer_name}</strong> has completed the following task:
          </p>

          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; color: #111827;">{task.get('title')}</h3>
            <p style="margin: 0; font-size: 13px; color: #6b7280;">
              Originally assigned to: {task.get('assignee_name') or task.get('assignee_email')}
            </p>
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <a href="{task_url}" style="display: inline-block; background-color: #047857; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px;">
              View Task Details &rarr;
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0 16px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            Sent automatically by TaskFlow. Please do not reply directly to this email.
          </p>
        </div>
      </body>
    </html>
    """

    _dispatch_email_async(
        sender=sender,
        recipient=recipient,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        client_id=client_id,
        client_secret=client_secret,
        refresh_token=refresh_token,
    )

