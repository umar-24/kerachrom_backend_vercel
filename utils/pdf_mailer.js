// pdfMailer.js
const nodemailer = require('nodemailer');

const pdfMailer = async ({ to, subject, pdfBuffer }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'linkplayer2809@gmail.com',
      pass: 'uguo ojdp hvbw elte',
    },
  });

  const mailOptions = {
    from: '"Kerachrom App" <Info@kerachrom.it>', 
    to,
    subject,
    text: 'Here is your PDF order receipt.',
    attachments: [
      {
        filename: 'order.pdf',
        content: pdfBuffer,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

module.exports = pdfMailer;
