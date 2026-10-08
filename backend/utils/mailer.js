import nodemailer from "nodemailer";
import { ENV } from "../config/env.js";

const transporter = nodemailer.createTransport({
  service: "gmail", // or swap for your provider's SMTP settings
  auth: { user: ENV.email.user, pass: ENV.email.password },
});

export async function sendPasswordResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: `"${ENV.appName}" <${ENV.email.user}>`,
    to,
    subject: `Reset your ${ENV.appName} password`,
    html: `<p>Click below to reset your password. This link expires in 1 hour.</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you didn't request this, ignore this email.</p>`,
  });
}

export async function sendRepDecisionEmail(to, name, approved, reason) {
  const subject = approved ? `You're approved as a ${ENV.appName} Rep!` : `Your ${ENV.appName} Rep application`;
  const html = approved
    ? `<p>Hi ${name},</p><p>Your Rep application has been approved. You can now log in and start managing course materials.</p>`
    : `<p>Hi ${name},</p><p>Your Rep application wasn't approved this time.${reason ? ` Reason: ${reason}` : ""}</p>`;
  await transporter.sendMail({ from: `"${ENV.appName}" <${ENV.email.user}>`, to, subject, html });
}
