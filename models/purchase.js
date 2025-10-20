// src/models/Purchase.js
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['ios', 'android', 'paypal', 'legacy'], required: true },

    // IAP
    productId: { type: String },
    transactionId: { type: String },
    originalTransactionId: { type: String, index: true, sparse: true }, // iOS idempotency

    // legacy/paypal
    amount: { type: Number },
    screenshotUrl: { type: String },
    note: { type: String },

    status: { type: String, default: 'completed' }, // completed | pending | rejected
    rawResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

// Unique idempotency for iOS: same (userId, originalTransactionId) only once
purchaseSchema.index({ userId: 1, originalTransactionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);
