const express = require("express");
const router = express.Router();
const User = require("../models/user");
const CreditTransaction = require("../models/credits");
const axios = require('axios');



// ✅ iOS In-App Purchase Verification (FIXED)
// router.post("/verify-iap", async (req, res) => {
//   const { userId, "receipt-data": receiptData, productId, transactionId } = req.body;

//   console.log("═══════════════════════════════════");
//   console.log("🔵 IAP Verification Request:");
//   console.log("   User ID:", userId);
//   console.log("   Product ID:", productId);
//   console.log("   Transaction ID:", transactionId);
//   console.log("   Receipt length:", receiptData?.length);
//   console.log("   Receipt preview (first 50):", receiptData?.substring(0, 50));
//   console.log("═══════════════════════════════════");

//   if (!userId || !receiptData) {
//     console.log("❌ Missing required fields");
//     return res.status(400).json({ 
//       status: "error", 
//       message: "Missing required fields (userId, receipt-data)" 
//     });
//   }

//   // ✅ Validate that receipt is proper base64
//   const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
//   if (!base64Regex.test(receiptData) || receiptData.length % 4 !== 0) {
//     console.error("❌ Invalid base64 receipt format");
//     return res.status(400).json({
//       status: "error",
//       message: "Receipt data must be valid base64 encoded string"
//     });
//   }

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       console.log("❌ User not found:", userId);
//       return res.status(404).json({ status: "error", message: "User not found" });
//     }

//     const sharedSecret = process.env.APPLE_SHARED_SECRET;
    
//     if (!sharedSecret) {
//       console.error("❌ APPLE_SHARED_SECRET not configured in environment");
//       return res.status(500).json({ 
//         status: "error", 
//         message: "Server configuration error" 
//       });
//     }

//     const requestBody = {
//       "receipt-data": receiptData,
//       "password": sharedSecret,
//       "exclude-old-transactions": true,
//     };

//     console.log("🔵 Verifying with Apple Production...");
//     let appleResponse = await axios.post(
//       "https://buy.itunes.apple.com/verifyReceipt", 
//       requestBody,
//       { timeout: 10000 }
//     );

//     // If sandbox receipt (status 21007), redirect to sandbox
//     if (appleResponse.data.status === 21007) {
//       console.log("🔵 Redirecting to Sandbox environment...");
//       appleResponse = await axios.post(
//         "https://sandbox.itunes.apple.com/verifyReceipt", 
//         requestBody,
//         { timeout: 10000 }
//       );
//     }

//     const data = appleResponse.data;
//     console.log("🍎 Apple Verification Response:");
//     console.log("   Status:", data.status);
//     console.log("   Environment:", data.environment);
//     console.log(JSON.stringify(data, null, 2));

//     // Check if verification was successful
//     if (data.status !== 0) {
//       console.error("❌ Apple receipt invalid, status:", data.status);
//       return res.status(400).json({ 
//         status: "error", 
//         message: "Apple receipt invalid", 
//         code: data.status 
//       });
//     }

//     // Find the transaction in the receipt
//     const inApp = data.receipt?.in_app || [];
//     console.log("🔵 In-app purchases in receipt:", inApp.length);
    
//     let validTx = null;
//     if (transactionId) {
//       validTx = inApp.find((tx) => tx.transaction_id === transactionId);
//     } else {
//       // If no transaction ID provided, get the most recent one for this product
//       const productTxs = inApp.filter(tx => tx.product_id === productId);
//       if (productTxs.length > 0) {
//         validTx = productTxs.sort((a, b) => 
//           parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms)
//         )[0];
//       }
//     }

//     if (!validTx) {
//       console.error("❌ Transaction not found in receipt");
//       return res.status(400).json({ 
//         status: "error", 
//         message: "Transaction not found in receipt" 
//       });
//     }

//     console.log("✅ Valid transaction found:", validTx.transaction_id);

//     // Prevent duplicates
//     const existingTx = await CreditTransaction.findOne({ 
//       appleTransactionId: validTx.transaction_id 
//     });
    
//     if (existingTx) {
//       console.log("⚠️ Duplicate transaction detected:", validTx.transaction_id);
//       return res.status(200).json({ 
//         status: "success", 
//         message: "Duplicate transaction - already processed",
//         addedCredits: 0,
//         newBalance: user.credits
//       });
//     }

//     // ✅ Map product ID to credits (update these to match your actual product IDs)
//     let creditsToAdd = 0;
    
//     // Map your actual product IDs here
//     const productCreditsMap = {
//       'com.kerachrom.starter.app': 50,
//     };

//     creditsToAdd = productCreditsMap[productId] || 0;

//     if (creditsToAdd === 0) {
//       console.error("❌ Unknown or invalid product ID:", productId);
//       return res.status(400).json({ 
//         status: "error", 
//         message: "Unknown product ID: " + productId 
//       });
//     }

//     console.log("🔵 Adding credits:", creditsToAdd);

//     // Update user credits
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $inc: { credits: creditsToAdd } },
//       { new: true }
//     );

//     // Create transaction record
//     await CreditTransaction.create({
//       userId,
//       productId,
//       appleTransactionId: validTx.transaction_id,
//       credits: creditsToAdd,
//       amount: creditsToAdd, // for compatibility
//       receiptData,
//       status: "approved",
//       method: "iap",
//       type: "purchase",
//       platform: "ios",
//       note: `iOS In-App Purchase - ${creditsToAdd} Credits`,
//       timestamp: new Date()
//     });

//     console.log("✅ Credits added successfully!");
//     console.log("   Added:", creditsToAdd);
//     console.log("   New balance:", updatedUser.credits);

//     res.status(200).json({
//       status: "success",
//       message: "Purchase verified and credits added",
//       addedCredits: creditsToAdd,
//       newBalance: updatedUser.credits,
//     });

//   } catch (err) {
//     console.error("❌ IAP verification error:");
//     console.error("   Message:", err.message);
//     console.error("   Response:", err.response?.data);
//     console.error("   Stack:", err.stack);
    
//     res.status(500).json({ 
//       status: "error", 
//       message: "Server error verifying receipt",
//       details: err.message
//     });
//   }
// });


router.post("/add-verified-purchase", async (req, res) => {
  const { userId, productId, transactionId, receiptData, verificationStatus, platform } = req.body;

  console.log("═══════════════════════════════════");
  console.log("🔵 Add Verified Purchase Request:");
  console.log("   User ID:", userId);
  console.log("   Product ID:", productId);
  console.log("   Transaction ID:", transactionId);
  console.log("   Verification Status:", verificationStatus);
  console.log("   Platform:", platform);
  console.log("═══════════════════════════════════");

  if (!userId || !productId || !transactionId) {
    console.log("❌ Missing required fields");
    return res.status(400).json({ 
      success: false,
      message: "Missing required fields (userId, productId, transactionId)" 
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // ✅ Check for duplicate transaction
    const existingTx = await CreditTransaction.findOne({ 
      appleTransactionId: transactionId 
    });
    
    if (existingTx) {
      console.log("⚠️ Duplicate transaction detected:", transactionId);
      return res.status(200).json({ 
        success: true,
        message: "Duplicate transaction - already processed",
        addedCredits: 0,
        newBalance: user.credits
      });
    }

    // ✅ Map product ID to credits
    const productCreditsMap = {
      'com.kerachrom.starter.app': 50,
      // Add more products here as needed
    };

    const creditsToAdd = productCreditsMap[productId] || 0;

    if (creditsToAdd === 0) {
      console.error("❌ Unknown or invalid product ID:", productId);
      return res.status(400).json({ 
        success: false,
        message: "Unknown product ID: " + productId 
      });
    }

    console.log("🔵 Adding credits:", creditsToAdd);

    // ✅ Update user credits
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    // ✅ Create transaction record
    await CreditTransaction.create({
      userId,
      productId,
      appleTransactionId: transactionId,
      credits: creditsToAdd,
      amount: creditsToAdd,
      receiptData: receiptData || '',
      status: "approved",
      method: "iap",
      type: "purchase",
      platform: platform || "ios",
      note: `iOS In-App Purchase - ${creditsToAdd} Credits (Verified by Flutter)`,
      verificationStatus: verificationStatus || "verified_by_flutter",
      timestamp: new Date()
    });

    console.log("✅ Credits added successfully!");
    console.log("   Added:", creditsToAdd);
    console.log("   New balance:", updatedUser.credits);

    res.status(200).json({
      success: true,
      message: "Credits added successfully",
      addedCredits: creditsToAdd,
      newBalance: updatedUser.credits,
    });

  } catch (err) {
    console.error("❌ Error adding credits:");
    console.error("   Message:", err.message);
    console.error("   Stack:", err.stack);
    
    res.status(500).json({ 
      success: false,
      message: "Server error adding credits",
      details: err.message
    });
  }
});

// ✅ Get all purchases (for admin)
router.get("/all-purchases", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ type: "purchase" })
      .sort({ timestamp: -1 })
      .populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Manual purchase submission (PayPal/Bank Transfer)
router.post("/purchase", async (req, res) => {
  const { userId, amount, note, screenshotUrl } = req.body;

  if (!userId || !amount || !screenshotUrl) {
    return res.status(400).json({ 
      success: false,
      message: "Missing required fields" 
    });
  }

  try {
    const transaction = await CreditTransaction.create({
      userId,
      type: "purchase",
      amount,
      note: note || "Manual purchase request",
      screenshotUrl,
      platform: "manual",
      status: "pending",
      timestamp: new Date()
    });

    res.status(200).json({ 
      success: true,
      message: "Purchase request submitted", 
      transactionId: transaction._id 
    });
  } catch (err) {
    console.error("Purchase submission error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to submit purchase request" 
    });
  }
});

// ✅ Get pending purchases (for admin)
router.get("/pending", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      type: "purchase", 
      status: "pending" 
    }).populate("userId", "firstName lastName email")
      .sort({ timestamp: -1 });
    
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Approve manual purchase (admin only)
router.post("/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount } = req.body;

    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ message: "Transaction already processed" });
    }

    const creditsToAdd = approvedAmount || transaction.amount;

    // Update transaction
    transaction.status = "approved";
    transaction.approvedAmount = creditsToAdd;
    await transaction.save();

    // Add credits to user
    const updatedUser = await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    res.json({ 
      success: true,
      message: "Purchase approved",
      transactionAmount: transaction.amount,
      addedAmount: creditsToAdd,
      newBalance: updatedUser.credits
    });
    
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Reject manual purchase (admin only)
router.post("/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ message: "Transaction already processed" });
    }

    transaction.status = "rejected";
    transaction.note = reason || "Purchase rejected by admin";
    await transaction.save();
    
    res.json({ 
      success: true,
      message: "Purchase rejected", 
      transaction 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get user's credit transactions
router.get("/:userId", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.params.userId,
      type: "purchase"
    }).sort({ timestamp: -1 });
    
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Deduct credits (for downloads/usage)
router.post('/deduct', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.credits < amount) {
    return res.status(400).json({ message: 'Insufficient credits' });
  }

  user.credits -= amount;
  await user.save();

  await CreditTransaction.create({
    userId,
    type: "usage",
    amount,
    note: `Deducted for download`,
    status: "approved"
  });

  res.json({ message: 'Credits deducted', newBalance: user.credits });
});

// ✅ Refund credits
router.post('/refund', async (req, res) => {
  const { userId, amount, note } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ message: 'Missing data' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.credits += amount;
    await user.save();

    await CreditTransaction.create({
      userId,
      type: "refund",
      amount,
      note: note || "Credits refunded",
      status: "approved",
      timestamp: new Date()
    });

    res.json({ 
      success: true,
      message: 'Credits refunded', 
      newBalance: user.credits 
    });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ message: "Failed to refund credits" });
  }
});

module.exports = router;