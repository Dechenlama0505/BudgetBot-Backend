const nodemailer = require("nodemailer");

/**
 * Create a reusable transporter using Gmail SMTP
 */
const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Send password reset email with link
 * @param {string} to - Recipient email
 * @param {string} resetLink - Full URL to reset password page with token
 * @returns {Promise<void>}
 */
const sendPasswordResetEmail = async (to, resetLink) => {
  console.log("[sendEmail] Creating transporter and sending to:", to);
  const transporter = createTransporter();

  const mailOptions = {
    from: `"BudgetBot" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset Your BudgetBot Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #265D6F;">Reset Your Password</h2>
        <p>You requested a password reset for your BudgetBot account.</p>
        <p>Click the link below to set a new password. This link will expire in 10 minutes.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; padding: 12px 24px; background-color: #265D6F; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="color: #6E828D; font-size: 14px;">
          If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #E0E6E7; margin: 24px 0;" />
        <p style="color: #8A9BA5; font-size: 12px;">
          BudgetBot – Your budget tracking companion
        </p>
      </div>
    `,
    text: `Reset Your BudgetBot Password

You requested a password reset for your BudgetBot account.

Click the link below to set a new password. This link will expire in 10 minutes.

${resetLink}

If you didn't request this, you can safely ignore this email. Your password will remain unchanged.

— BudgetBot`,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log("[sendEmail] Email sent successfully. MessageId:", result.messageId);
};

module.exports = {
  sendPasswordResetEmail,
};
