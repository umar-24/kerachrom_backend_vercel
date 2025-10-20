const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    preview: { type: String, enum: ["Black/White", "Color"], required: true },
    price: { type: Number, required: true },
    image_urls: { type: Array, required: true },
    order_note: { type: String, default: "" },
    po: { type: String, default: "" },
    product_code: { type: String, default: "" },
    template_name: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    phone: { type: String, default: "" },
    payment_status: {
      type: String,
      required: true,
    },
    order_status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    reseller_order_status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    transaction_id: { type: String, default: null },

    // New Fields for Reseller Orders
    is_reseller_order: {
      type: Boolean,
      default: false, // Default false for normal users, true for resellers
    },
    is_draft: {
      type: Boolean,
      default: false,
    },
    businessUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Stores the Business User ID if order is from a reseller
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // Stores the Business User ID if order is from a reseller
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
