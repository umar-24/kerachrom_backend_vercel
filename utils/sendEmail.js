const nodemailer = require("nodemailer");

// 🔐 Configure transporter with Gmail and app password
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "linkplayer2809@gmail.com",
    pass: "uguo ojdp hvbw elte", // ✅ App Password from Google
  },
});

// 📧 Email sending utility
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    await transporter.sendMail({
      from: '"Kerachrom App" <Info@kerachrom.it>', // Sender
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    console.log("📩 Email sent successfully to", to);
  } catch (error) {
    console.error("❌ Email sending error:", error.message);
    throw new Error("Email could not be sent");
  }
};

module.exports = sendEmail;
