const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/user");
const CreditTransaction = require("../models/credits");

// Get all purchases (Admin)
router.get("/all-purchases", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ type: "purchase" })
      .sort({ timestamp: -1 })
      .populate("userId", "firstName lastName email");
    
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching all purchases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Manual purchase request (Web/Android)
router.post("/purchase", async (req, res) => {
  const { userId, amount, note, screenshotUrl } = req.body;

  if (!userId || !amount || !screenshotUrl) {
    return res.status(400).send("Missing required fields");
  }

  const transaction = new CreditTransaction({
    userId,
    type: "purchase",
    amount,
    note: note || "Purchase request submitted",
    screenshotUrl,
    status: "pending"
  });

  await transaction.save();
  res.status(200).send({ message: "Purchase request submitted", transactionId: transaction._id });
});

router.post("/paypal/webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource;
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      const customId = resource.custom_id; // the userId we attached earlier

      if (!customId) {
        console.warn("⚠️ Missing custom_id in PayPal webhook");
        return res.sendStatus(200);
      }

      const user = await User.findById(customId);
      if (!user) {
        console.warn(`⚠️ User not found for webhook: ${customId}`);
        return res.sendStatus(200);
      }

      // Prevent double credit
      const alreadyCredited = await CreditTransaction.findOne({ note: `PayPal-${orderId}` });
      if (alreadyCredited) return res.sendStatus(200);

      const creditsToAdd = 50; // adjust dynamically if needed

      await User.findByIdAndUpdate(customId, { $inc: { credits: creditsToAdd } });
      await CreditTransaction.create({
        userId: customId,
        type: "purchase",
        amount: creditsToAdd,
        note: `PayPal-${orderId}`,
        status: "approved",
      });

      console.log(`✅ Auto credited ${creditsToAdd} to ${customId}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});


// Get pending purchases
router.get("/pending", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ 
      type: "purchase", 
      status: "pending" 
    }).populate("userId", "firstName lastName email");
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve purchase
router.post("/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedAmount } = req.body;

    const transaction = await CreditTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const creditsToAdd = approvedAmount || transaction.amount;

    transaction.status = "approved";
    await transaction.save();

    const updatedUser = await User.findByIdAndUpdate(
      transaction.userId,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    res.json({ 
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

// Reject purchase
router.post("/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await CreditTransaction.findByIdAndUpdate(
      id,
      { 
        status: "rejected",
        note: reason || "Purchase rejected" 
      },
      { new: true }
    );
    
    res.json({ message: "Purchase rejected", transaction });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user's credit transactions
router.get("/transactions/:userId", async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.params.userId
    }).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user data with credits
router.get("/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Deduct credits
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

// Refund credits
router.post('/refund', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.credits += amount;
  await user.save();

  await CreditTransaction.create({
    userId,
    type: "refund",
    amount,
    note: `Refunded after cancel`,
    status: "approved"
  });

  res.json({ message: 'Credits refunded', newBalance: user.credits });
});

// IAP Purchase Endpoint (iOS & Android)
// router.post('/iap-purchase', async (req, res) => {
//   try {
//     const { userId, purchaseId, productId, credits, platform, transactionDate, receiptData } = req.body;

//     console.log('IAP Purchase Request:', { userId, purchaseId, productId, credits, platform });

//     // Validation
//     if (!userId || !purchaseId || !productId || !credits) {
//       return res.status(400).json({ 
//         error: 'Missing required fields',
//         received: { userId, purchaseId, productId, credits }
//       });
//     }

//     // 1. Check if purchase already processed
//     const existingPurchase = await CreditTransaction.findOne({ 
//       purchaseId: purchaseId 
//     });

//     if (existingPurchase) {
//       console.log(`Duplicate purchase detected: ${purchaseId}`);
//       const user = await User.findById(userId);
//       return res.status(200).json({ 
//         message: 'Purchase already processed',
//         newBalance: user.credits,
//         credits: user.credits
//       });
//     }

//     // 2. Verify receipt for iOS
//     if (platform === 'ios' && receiptData) {
//       try {
//         const verificationResponse = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', {
//           'receipt-data': receiptData,
//           'password': '9e372c5bdb294b459391436dcda62329'
//         });

//         const verificationData = verificationResponse.data;
//         if (verificationData.status !== 0) {
//           return res.status(400).json({ 
//             error: 'Receipt verification failed',
//             status: verificationData.status 
//           });
//         }
//         console.log('iOS receipt verified successfully');
//       } catch (verificationError) {
//         console.error('Receipt verification error:', verificationError);
//         return res.status(400).json({ 
//           error: 'Receipt verification failed',
//           details: verificationError.message 
//         });
//       }
//     }

//     // 3. Find user and update credits in MongoDB
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const oldCredits = user.credits;
//     user.credits = (user.credits || 0) + parseInt(credits);
//     await user.save();

//     // 4. Save transaction record
//     const transaction = new CreditTransaction({
//       userId,
//       purchaseId,
//       productId,
//       type: "purchase",
//       amount: parseInt(credits),
//       platform,
//       status: 'approved',
//       timestamp: transactionDate ? new Date(transactionDate) : new Date(),
//       note: `IAP purchase via ${platform} (${productId})`
//     });
//     await transaction.save();

//     console.log(`✅ IAP Purchase successful: ${purchaseId} - User: ${userId} - Credits: ${oldCredits} -> ${user.credits}`);

//     res.status(200).json({
//       success: true,
//       message: 'Purchase processed successfully',
//       credits: user.credits,
//       newBalance: user.credits,
//       addedCredits: parseInt(credits),
//       transaction: {
//         id: transaction._id,
//         purchaseId: transaction.purchaseId
//       }
//     });

//   } catch (error) {
//     console.error('IAP purchase processing error:', error);
//     res.status(500).json({ 
//       error: 'Failed to process purchase',
//       details: error.message 
//     });
//   }
// });


// IAP Purchase Endpoint (iOS & Android) - FIXED VERSION
// ✅ SECURE IAP Purchase Endpoint - MUST VERIFY RECEIPT
router.post('/iap-purchase', async (req, res) => {
  try {
    const { userId, purchaseId, productId, credits, platform, transactionDate, receiptData } = req.body;

    console.log('📱 IAP Purchase Request:', { 
      userId, 
      purchaseId: purchaseId || 'PENDING', 
      productId, 
      credits, 
      platform,
      hasReceipt: !!receiptData 
    });

    // ✅ Validation
    if (!userId || !productId || !credits) {
      console.error('❌ Missing required fields:', { userId, productId, credits });
      return res.status(400).json({ 
        error: 'Missing required fields (userId, productId, or credits)',
        received: { userId, productId, credits }
      });
    }

    // ✅ CRITICAL: iOS MUST have receipt data
    if (platform === 'ios' && !receiptData) {
      console.error('❌ iOS purchase missing receipt data');
      return res.status(400).json({ 
        error: 'Receipt verification required for iOS purchases',
        message: 'No receipt data provided'
      });
    }

    // ✅ Generate fallback purchaseId
    const finalPurchaseId = purchaseId || `${productId}-${userId}-${Date.now()}`;
    console.log('🔑 Using Purchase ID:', finalPurchaseId);

    // ✅ Check for duplicate
    const existingPurchase = await CreditTransaction.findOne({ 
      $or: [
        { purchaseId: finalPurchaseId },
        { 
          userId: userId,
          productId: productId,
          timestamp: { 
            $gte: new Date(Date.now() - 5 * 60 * 1000) 
          }
        }
      ]
    });

    if (existingPurchase) {
      console.log(`⚠️ Duplicate purchase detected: ${finalPurchaseId}`);
      const user = await User.findById(userId);
      return res.status(200).json({ 
        success: true,
        message: 'Purchase already processed',
        newBalance: user.credits,
        credits: user.credits,
        isDuplicate: true
      });
    }

    // ✅ MANDATORY RECEIPT VERIFICATION FOR iOS
    let receiptVerified = false;
    let receiptError = null;

    if (platform === 'ios') {
      try {
        console.log('🔍 Verifying iOS receipt (MANDATORY)...');
        
        // Try Sandbox first (for TestFlight)
        let verificationResponse = await axios.post(
          'https://sandbox.itunes.apple.com/verifyReceipt', 
          {
            'receipt-data': receiptData,
            'password': '9e372c5bdb294b459391436dcda62329'
          },
          {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        let verificationData = verificationResponse.data;
        console.log(`📋 Apple Response Status: ${verificationData.status}`);

        // Handle status 21007 (sandbox receipt sent to production)
        if (verificationData.status === 21007) {
          console.log('🔄 Sandbox receipt detected, trying production URL...');
          verificationResponse = await axios.post(
            'https://buy.itunes.apple.com/verifyReceipt',
            {
              'receipt-data': receiptData,
              'password': '9e372c5bdb294b459391436dcda62329'
            },
            { timeout: 10000 }
          );
          verificationData = verificationResponse.data;
          console.log(`📋 Production Response Status: ${verificationData.status}`);
        }

        // Check verification status
        if (verificationData.status === 0) {
          receiptVerified = true;
          console.log('✅ iOS receipt VERIFIED successfully');
          
          // Additional validation: check product ID matches
          const receipt = verificationData.receipt;
          if (receipt && receipt.in_app && receipt.in_app.length > 0) {
            const latestPurchase = receipt.in_app[receipt.in_app.length - 1];
            if (latestPurchase.product_id !== productId) {
              console.error(`❌ Product ID mismatch: Expected ${productId}, got ${latestPurchase.product_id}`);
              return res.status(400).json({
                error: 'Receipt verification failed',
                message: 'Product ID does not match receipt'
              });
            }
          }
          
        } else if (verificationData.status === 21002) {
          receiptError = 'Invalid receipt data';
        } else if (verificationData.status === 21003) {
          receiptError = 'Receipt authentication failed';
        } else if (verificationData.status === 21005) {
          receiptError = 'Apple receipt server unavailable';
        } else {
          receiptError = `Apple verification failed (Status: ${verificationData.status})`;
        }

      } catch (verificationError) {
        console.error('❌ Receipt verification error:', verificationError.message);
        receiptError = 'Receipt verification network error';
      }

      // ✅ REJECT if receipt not verified
      if (!receiptVerified) {
        console.error('🚫 RECEIPT VERIFICATION FAILED - BLOCKING PURCHASE');
        return res.status(400).json({
          error: 'Receipt verification failed',
          message: receiptError || 'Unable to verify purchase with Apple',
          details: 'Payment was not confirmed by Apple. Please try again or contact support.'
        });
      }
    }

    // ✅ Only process if receipt verified (iOS) or non-iOS platform
    if (platform === 'ios' && !receiptVerified) {
      return res.status(400).json({
        error: 'Purchase verification required',
        message: 'Cannot process unverified purchase'
      });
    }

    // ✅ NOW safe to add credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldCredits = user.credits || 0;
    const creditsToAdd = parseInt(credits);
    user.credits = oldCredits + creditsToAdd;
    await user.save();

    // ✅ Save transaction
    const transaction = new CreditTransaction({
      userId,
      purchaseId: finalPurchaseId,
      productId,
      type: "purchase",
      amount: creditsToAdd,
      platform: platform || 'ios',
      status: 'approved',
      timestamp: transactionDate ? new Date(transactionDate) : new Date(),
      note: `IAP purchase via ${platform} (${productId}) [Receipt Verified: ${receiptVerified}]`
    });
    await transaction.save();

    console.log(`✅ SECURE Purchase Completed: ${finalPurchaseId}`);
    console.log(`   User: ${userId}`);
    console.log(`   Credits: ${oldCredits} → ${user.credits} (+${creditsToAdd})`);
    console.log(`   Receipt Verified: ${receiptVerified}`);

    res.status(200).json({
      success: true,
      message: 'Purchase processed successfully',
      credits: user.credits,
      newBalance: user.credits,
      addedCredits: creditsToAdd,
      receiptVerified,
      transaction: {
        id: transaction._id,
        purchaseId: finalPurchaseId
      }
    });

  } catch (error) {
    console.error('❌ IAP purchase processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process purchase',
      details: error.message 
    });
  }
});

// Get user credits
router.get('/balance/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      credits: user.credits || 0,
      userId: user._id
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Add these to your existing credits.js file

// PayPal Create Order
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { userId, credits = 50, amount = 10.00 } = req.body;

    // Create PayPal order
    const paypalResponse = await axios.post(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amount.toString()
          },
          description: `${credits} Credits Purchase`,
          custom_id: userId
        }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAYPAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      id: paypalResponse.data.id,
      status: paypalResponse.data.status,
      approvalUrl: paypalResponse.data.links.find(link => link.rel === 'approve').href
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// PayPal Capture Order
router.post('/paypal/capture-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId, credits = 50 } = req.body;

    // Capture PayPal payment
    const captureResponse = await axios.post(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAYPAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (captureResponse.data.status === 'COMPLETED') {
      // Update user credits in MongoDB
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.credits = (user.credits || 0) + parseInt(credits);
      await user.save();

      // Save transaction record
      const transaction = new CreditTransaction({
        userId,
        type: "purchase",
        amount: parseInt(credits),
        platform: 'web',
        status: 'approved',
        note: `PayPal payment - Order ${orderId}`
      });
      await transaction.save();

      res.json({
        success: true,
        message: 'Payment captured successfully',
        credits: user.credits,
        newBalance: user.credits
      });
    } else {
      throw new Error('Payment not completed');
    }
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
}); 

module.exports = router;