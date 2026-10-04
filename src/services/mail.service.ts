// Outgoing email service (no-reply notifications).
// Configuration is optional: if SMTP_HOST/USER/PASS are not set, sending is
// skipped with a warning and the API flow continues normally.
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import env from '../config/env.js'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // implicit TLS only on 465; otherwise STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  }
  return transporter
}

export function isEmailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
}

// Fire-and-forget: never throws, never blocks the request.
export function sendEmail(to: string, subject: string, text: string, html: string): void {
  const t = getTransporter()
  if (!t) {
    console.warn('📧 Email skipped (SMTP not configured). Set SMTP_HOST/SMTP_USER/SMTP_PASS to enable.')
    return
  }
  void t
    .sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      text,
      html,
      // Mark as auto-generated no-reply mail
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    })
    .then(() => console.log(`📧 Email sent to ${to}: ${subject}`))
    .catch((err) => console.warn(`📧 Email to ${to} failed: ${err?.message || err}`))
}
