"""
Email sending utility — DataPilot
Uses Gmail SMTP (smtplib, built into Python — no third-party email
service signup needed). Requires a Gmail "App Password", not your
regular Gmail password — Google blocks regular passwords for SMTP
since 2022 for security reasons.

Setup (one-time, see README in scripts/ for the same steps):
1. Enable 2-Step Verification on the Gmail account that will send mail
   (myaccount.google.com/security)
2. Go to myaccount.google.com/apppasswords, generate an app password
   for "Mail" — Google gives you a 16-character password
3. Set these in backend/.env:
     GMAIL_ADDRESS=your-email@gmail.com
     GMAIL_APP_PASSWORD=the16characterpassword (no spaces)

If these aren't set, email sending fails gracefully — the calling
code (e.g. forgot-password) should still tell the user what to do
manually rather than crashing.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

GMAIL_ADDRESS      = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def is_email_configured() -> bool:
    return bool(GMAIL_ADDRESS and GMAIL_APP_PASSWORD)


def send_email(to_email: str, subject: str, html_body: str, text_body: str = None) -> bool:
    """
    Sends an email via Gmail SMTP. Returns True on success, False on
    failure (logs the error but doesn't raise — callers should treat
    email as best-effort and have a fallback, e.g. showing the reset
    link directly in the UI if email isn't configured/fails).
    """
    if not is_email_configured():
        print("[email] GMAIL_ADDRESS / GMAIL_APP_PASSWORD not set in .env — skipping send.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"DataPilot <{GMAIL_ADDRESS}>"
        msg["To"]      = to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())

        return True
    except Exception as e:
        print(f"[email] Failed to send to {to_email}: {e}")
        return False


def send_password_reset_email(to_email: str, reset_link: str, user_name: str = "there") -> bool:
    subject = "Reset your DataPilot password"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6B5FED;">DataPilot</h2>
      <p>Hi {user_name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="{reset_link}" style="background: #6B5FED; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size: 13px; color: #9CA3AF;">If the button doesn't work, copy this link: {reset_link}</p>
    </div>
    """
    text = f"Hi {user_name},\n\nReset your DataPilot password: {reset_link}\n\nThis link expires in 1 hour."
    return send_email(to_email, subject, html, text)


def send_team_invite_email(to_email: str, invite_link: str, org_name: str, inviter_name: str) -> bool:
    subject = f"{inviter_name} invited you to join {org_name} on DataPilot"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6B5FED;">DataPilot</h2>
      <p>{inviter_name} has invited you to join <strong>{org_name}</strong> on DataPilot.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="{invite_link}" style="background: #6B5FED; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Accept Invitation
        </a>
      </p>
      <p style="font-size: 13px; color: #9CA3AF;">If the button doesn't work, copy this link: {invite_link}</p>
    </div>
    """
    text = f"{inviter_name} invited you to join {org_name} on DataPilot.\n\nAccept here: {invite_link}"
    return send_email(to_email, subject, html, text)
