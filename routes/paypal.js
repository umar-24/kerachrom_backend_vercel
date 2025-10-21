// const express = require("express");
// const router = express.Router();
// const { client } = require("../utils/paypal_client");
// const User = require("../models/user");
// const CreditTransaction = require("../models/credits");

// // Create PayPal Order
// router.post("/create-order", async (req, res) => {
//   const request =
//     new (require("@paypal/checkout-server-sdk").orders.OrdersCreateRequest)();
//   request.prefer("return=representation");
//   request.requestBody({
//   intent: "CAPTURE",
//   purchase_units: [
//     {
//       amount: {
//         currency_code: "USD",
//         value: "10.00",
//       },
//     },
//   ],
//   application_context: {
//     brand_name: "Kera Chrom",
//     landing_page: "LOGIN",       // Shows PayPal + Card option
//     user_action: "PAY_NOW",        // Highlights pay now button
//     return_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/", // TODO: Update to your frontend
//     cancel_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/"   // TODO: Update to your frontend
//   }
// });


//   try {
//     const order = await client().execute(request);
//     res.json({ id: order.result.id });
//   } catch (err) {
//     console.error("PayPal Order Creation Error:", err);
//     res.status(500).json({ message: "Failed to create PayPal order" });
//   }
// });

// // Capture PayPal Order and credit user
// router.post("/capture-order/:orderId", async (req, res) => {
//   const { orderId } = req.params;
//   const { userId } = req.body;

//   if (!userId) return res.status(400).json({ message: "User ID is required" });

//   try {
//     const request =
//       new (require("@paypal/checkout-server-sdk").orders.OrdersCaptureRequest)(
//         orderId
//       );
//     request.requestBody({});

//     const capture = await client().execute(request); // Credit the user 50 credits

//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $inc: { credits: 50 } },
//       { new: true }
//     ); // Log transaction

//     const creditTransaction = new CreditTransaction({
//       userId,
//       type: "purchase",
//       amount: 50,
//       note: "PayPal payment of $10 for 50 credits",
//       status: "approved",
//     });

//     await creditTransaction.save(); // Add to user's transaction history (optional)

//     await User.findByIdAndUpdate(userId, {
//       $push: {
//         transactions: {
//           type: "purchase",
//           amount: 50,
//           note: `PayPal purchase (${creditTransaction._id})`,
//           timestamp: new Date(),
//         },
//       },
//     });

//     res.json({
//       message: "Payment successful, 50 credits added",
//       creditsAdded: 50,
//       newBalance: updatedUser.credits,
//     });
//   } catch (err) {
//     console.error("PayPal Capture Error:", err);
//     res.status(500).json({ message: "Payment capture failed" });
//   }
// });

// module.exports = router;



const express = require("express");
const router = express.Router();
const { client } = require("../utils/paypal_client");
const User = require("../models/user");
const CreditTransaction = require("../models/credits");

// ====== Create PayPal Order ======
router.post("/create-order", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const paypal = require("@paypal/checkout-server-sdk");
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: "10.00", // fixed amount for 50 credits
          },
          custom_id: userId,
        },
      ],
      application_context: {
        brand_name: "Kera Chrom",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/",
        cancel_url: "https://staging.d2bhfx46t69ao9.amplifyapp.com/",
      },
    });

    const order = await client().execute(request);
    const approvalUrl = order.result.links.find((l) => l.rel === "approve")?.href;

    if (!approvalUrl) {
      return res.status(500).json({ message: "PayPal approval URL not found" });
    }

    res.json({
      orderId: order.result.id,
      approvalUrl,
    });
  } catch (err) {
    console.error("PayPal Order Creation Error:", err);
    res.status(500).json({ message: "Failed to create PayPal order" });
  }
});


// ====== Capture PayPal Order ======
router.post("/capture-order/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const { userId } = req.body;

  if (!userId || !orderId) {
    return res.status(400).json({ message: "userId and orderId are required" });
  }

  try {
    const paypal = require("@paypal/checkout-server-sdk");
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client().execute(request);
    const status = capture.result.status;

    if (status !== "COMPLETED") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // ✅ Add 50 credits for $10 payment
    const creditsToAdd = 50;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    // ✅ Log credit transaction
    const creditTransaction = new CreditTransaction({
      userId,
      type: "purchase",
      amount: creditsToAdd,
      note: `PayPal payment of $10 for ${creditsToAdd} credits`,
      status: "approved",
    });

    await creditTransaction.save();

    await User.findByIdAndUpdate(userId, {
      $push: {
        transactions: {
          type: "purchase",
          amount: creditsToAdd,
          note: `PayPal purchase (${creditTransaction._id})`,
          timestamp: new Date(),
        },
      },
    });
 
    res.json({
      message: "✅ Payment successful — 50 credits added",
      creditsAdded: creditsToAdd,
      newBalance: updatedUser.credits,
    });
  } catch (err) {
    console.error("PayPal Capture Error:", err);
    res.status(500).json({ message: "Payment capture failed" });
  }
});

module.exports = router;
