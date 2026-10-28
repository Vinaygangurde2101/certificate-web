import nodemailer from 'nodemailer';

let transporter = null;

export function getEmailTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
  }
  return transporter;
}

/**
 * Sends or simulates participant access code notification
 */
export async function sendAccessCodeEmail({ to, participantName, eventName, accessCode, portalUrl }) {
  const isDemo = process.env.DEMO_MODE === 'true' || !process.env.SMTP_USER;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">Your Certificate is Ready! 🎓</h2>
      <p style="color: #334155; font-size: 16px;">Hello <strong>${participantName}</strong>,</p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Congratulations! Your official certificate of completion for <strong>${eventName}</strong> has been issued and is available for secure download.
      </p>
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600;">Your Unique Access Code</span>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em; color: #2563eb; margin-top: 8px; font-family: monospace;">
          ${accessCode}
        </div>
      </div>
      <p style="color: #334155; font-size: 15px;">
        Click the link below and enter your access code to view and download your verified certificate:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${portalUrl || (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/portal` : (process.env.CLIENT_URL ? `${process.env.CLIENT_URL.replace(/\/+$/, '')}/portal` : 'http://localhost:5173/portal'))}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 16px; font-weight: 600; border-radius: 8px;">
          Access Certificate Portal →
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        For your security, do not share this access code. If you have any questions, reach out to your event organizer.
      </p>
    </div>
  `;

  if (isDemo) {
    console.log(`[DEMO EMAIL] Access code for ${participantName} (${to}): [${accessCode}]`);
    return {
      success: true,
      mode: 'demo',
      simulated: true,
      recipient: to,
      accessCode,
      message: 'Demo mode: Email simulated successfully.'
    };
  }

  const mailer = getEmailTransporter();
  if (!mailer) {
    return {
      success: true,
      mode: 'demo_fallback',
      simulated: true,
      recipient: to,
      accessCode,
      message: 'SMTP not configured. Email simulated in demo mode.'
    };
  }

  try {
    const info = await mailer.sendMail({
      from: process.env.SMTP_FROM || 'Smart Cert Portal <no-reply@smartcert.internal>',
      to,
      subject: `Your Certificate for ${eventName} - Access Code`,
      html: htmlContent
    });

    return {
      success: true,
      mode: 'smtp',
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
