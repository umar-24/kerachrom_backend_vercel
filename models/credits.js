// const mongoose = require("mongoose");

// const creditTransactionSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },
//   type: {
//     type: String,
//     enum: ["purchase", "usage"],
//     required: true
//   },
//   amount: {
//     type: Number,
//     required: true
//   },
//   note: {
//     type: String,
//     default: ""
//   },
//   status: {
//     type: String,
//     enum: ["pending", "approved"],
//     default: "approved" // For usage it's always approved; for purchases it's reviewed by admin
//   },
//   timestamp: {
//     type: Date,
//     default: Date.now
//   },
//   screenshotUrl: {
//     type: String, // Optional – Cloudinary URL if applicable
//     default: ""
//   }
// });

// const CreditTransaction = mongoose.model("CreditTransaction", creditTransactionSchema);
// module.exports = CreditTransaction;

const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["purchase", "usage", "refund"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  productId: {
    type: String,
    default: null
  },
  receiptData: {
    type: String,
    default: null
  },
  platform: {
    type: String,
    enum: ["ios", "android", "web", "manual"],
    default: "manual"
  },
  note: {
    type: String,
    default: ""
  },
  screenshotUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved"
  },
  approvedAmount: {
    type: Number,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
creditTransactionSchema.index({ userId: 1, timestamp: -1 });
creditTransactionSchema.index({ status: 1, type: 1 });
creditTransactionSchema.index({ receiptData: 1 }); // For duplicate check

module.exports = mongoose.model("CreditTransaction", creditTransactionSchema);