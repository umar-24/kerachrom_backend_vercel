const express = require('express');
const multer = require('multer');
const pdfMailer = require('../utils/pdf_mailer');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post('/send-email', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBuffer = req.file.buffer;
    const userEmail = req.body.email;

    // Send to user
    await pdfMailer({
      to: userEmail,
      subject: 'Your PDF Receipt',
      pdfBuffer,
    });

    // Send to admin
    await pdfMailer({
      to: 'admin@kerachrom.it', // Replace with real admin email
      subject: 'New Order PDF - Admin Copy',
      pdfBuffer,
    });

    res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Email send failed:', error);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});


module.exports = router;
