// Email service using the Resend REST API (no SDK dependency needed)

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Exness CFD <verify@sanskarshukla.com>";

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

export function generateVerificationCode(): string {
  // 4-digit code, 1000-9999
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(
      "[EMAIL] RESEND_API_KEY not set - skipping verification email. User will be auto-verified.",
    );
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: `${code} is your Exness CFD verification code`,
        html: `
          <div style="font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #141D22; color: #ffffff; border-radius: 12px;">
            <h1 style="font-size: 20px; margin: 0 0 8px;">Verify your email</h1>
            <p style="color: #B7BDC6; font-size: 14px; margin: 0 0 24px;">
              Enter this code in Exness CFD to activate your account. It expires in 15 minutes.
            </p>
            <div style="background: #1E2A32; border: 1px solid #2B3139; border-radius: 8px; padding: 20px; text-align: center;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #0ECB81;">${code}</span>
            </div>
            <p style="color: #6B7280; font-size: 12px; margin: 24px 0 0;">
              If you didn't create an account on exness.sanskarshukla.com, you can ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[EMAIL] Resend API error ${response.status}: ${body}`);
      return false;
    }

    console.log(`[EMAIL] Verification code sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send verification email:", err);
    return false;
  }
}
