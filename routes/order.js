const express = require("express");
const Order = require("../models/orders");
const User = require("../models/user");
const mongoose = require("mongoose");
const router = express.Router();
const { client } = require('../utils/paypal_client');
const paypal = require('@paypal/checkout-server-sdk');

// Create an order
router.post("/create-order", async (req, res) => {
  try {
    console.log("📌 Incoming Request Body:", req.body); // Debug log

    const { user_id, size, preview, price, image_urls, order_note, payment_status, order_status,
      template_name, transaction_id, businessUserId, is_delivered_to_admin, reseller_order_status,
      companyId, product_code, is_draft, country, city, phone,po, } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Debug logs to check businessUserId
    console.log("📌 Debug: Received businessUserId:", businessUserId);

    // Ensure `businessUserId` is stored correctly
    const isResellerOrder = businessUserId ? true : false;
    const isDeliveredToAdmin = true;
    // const isDeliveredToAdmin = businessUserId ? false : true;

    const newOrder = new Order({
      user_id,
      size,
      preview,
      price,
      image_urls,
      payment_status,
      order_note,
      template_name,
      order_status: order_status || "pending",
      reseller_order_status: reseller_order_status || "pending",
      transaction_id,
      businessUserId: businessUserId || null, // Ensure correct assignment
      is_reseller_order: isResellerOrder,
      is_delivered_to_admin: isDeliveredToAdmin,
      companyId: companyId, // ✅ Link resellers to their company
      product_code: product_code,
      is_delivered_to_admin: is_delivered_to_admin,
      is_draft: is_draft,
      city: city,
      country: country,
      phone: phone,
      po: po,
    });

    await newOrder.save();
    res.status(201).json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    res.status(400).json({ message: "Error creating order", error: error.message });
  }
});

// Update order status
router.put("/update-order/:id", async (req, res) => {
  try {
    const {
      order_status,
      reseller_order_status,
      is_delivered_to_admin,
      transaction_id,
      payment_status,
      is_draft,  // Destructured but not used in updateFields
      
    } = req.body;

    // Valid order status values
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const validPaymentStatuses = ["pending", "processing", "completed", "failed"];

    // Validation checks...

    const updateFields = {};
    if (order_status) updateFields.order_status = order_status;
    if (reseller_order_status) updateFields.reseller_order_status = reseller_order_status;
    if (is_delivered_to_admin !== undefined) updateFields.is_delivered_to_admin = is_delivered_to_admin;
    if (transaction_id) updateFields.transaction_id = transaction_id;
    if (payment_status) updateFields.payment_status = payment_status;
    if (is_draft !== undefined) updateFields.is_draft = is_draft;  // Add this line

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order updated successfully", order: updatedOrder });
  } catch (error) {
    res.status(400).json({ message: "Error updating order", error: error.message });
  }
});



// **Get all orders*
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// **Get orders by user ID**
router.get("/orders/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const orders = await Order.find({ user_id });

    if (orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    res.json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// Get order details by order ID
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate ObjectId format if you want (optional)
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Find order by ID
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order details retrieved successfully", order });
  } catch (error) {
    res.status(500).json({ message: "Error fetching order details", error: error.message });
  }
});


router.get("/api/reseller-orders/:businessUserId", async (req, res) => {
  try {
    const { businessUserId } = req.params;

    // Validate that the business user exists
    const businessUser = await User.findById(businessUserId);
    if (!businessUser || businessUser.accountType !== "Business") {
      return res.status(403).json({
        message: "Only business users can fetch reseller orders",
      });
    }

    // Get all resellers created by this business user
    const resellers = await User.find({ businessUserId }).select("_id");

    // Extract reseller IDs
    const resellerIds = resellers.map((reseller) => reseller._id);

    if (resellerIds.length === 0) {
      return res.json({
        message: "No resellers found",
        orders: [],
      });
    }

    // Fetch orders placed by these resellers
    const orders = await Order.find({ user_id: { $in: resellerIds } });

    res.json({
      message: "Reseller orders retrieved successfully",
      orders,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching reseller orders",
      error: error.message,
    });
  }
});

// Get orders by company (business user ID)
router.get("/company-orders/:businessUserId", async (req, res) => {
  try {
    const { businessUserId } = req.params;

    if (!businessUserId) {
      return res.status(400).json({ message: "Business User ID is required" });
    }

    // Find all orders linked to this business user
    const orders = await Order.find({ businessUserId });

    if (orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this company" });
    }

    res.json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

// Get orders by company ID
router.get("/api/company-orders/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // Fetch all orders where the companyId matches
    const orders = await Order.find({ companyId });

    if (orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this company" });
    }

    res.json({ message: "Orders retrieved successfully", orders });
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
});

router.post('/paypal/create-order', async (req, res) => {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: req.body.amount || '10.00',
      },
    }],
      application_context: {
    brand_name: "Kera Chrom",
    landing_page: "LOGIN",       // Shows PayPal + Card option
    user_action: "PAY_NOW",        // Highlights pay now button
    return_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/", // TODO: Update to your frontend
    cancel_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/"   // TODO: Update to your frontend
  }
  });

  try {
    const order = await client().execute(request);
    res.json({ id: order.result.id }); // Send order ID back to Flutter
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  const orderId = req.body.orderId;

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  try {
    const capture = await client().execute(request);
    res.json({ status: 'success', details: capture.result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});


module.exports = router;
