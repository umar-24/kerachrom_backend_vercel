const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["purchase", "usage"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  note: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["pending", "approved"],
    default: "approved" // For usage it's always approved; for purchases it's reviewed by admin
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  screenshotUrl: {
    type: String, // Optional – Cloudinary URL if applicable
    default: ""
  }
});

const CreditTransaction = mongoose.model("CreditTransaction", creditTransactionSchema);
module.exports = CreditTransaction;
