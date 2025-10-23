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


 
 router.post('/iap-purchase', async (req, res) => {
  try {
    const { userId, purchaseId, productId, credits, platform } = req.body;

    console.log('\n=== 📱 IAP PURCHASE REQUEST ===');
    console.log('👤 User:', userId);
    console.log('🎯 Product:', productId);
    console.log('💳 Purchase ID:', purchaseId);
    console.log('🪙 Credits:', credits);

    // ✅ Simple validation
    if (!userId || !purchaseId || !productId || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ Check duplicate
    const existing = await CreditTransaction.findOne({ purchaseId });
    if (existing) {
      console.log('⚠️ Duplicate purchase');
      const user = await User.findById(userId);
      return res.status(200).json({ 
        success: true, 
        credits: user.credits,
        isDuplicate: true 
      });
    }

    // ✅ Update user credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creditsToAdd = parseInt(credits);
    user.credits = (user.credits || 0) + creditsToAdd;
    await user.save();

    // ✅ Save transaction
    const transaction = new CreditTransaction({
      userId,
      purchaseId,
      productId,
      type: "purchase",
      amount: creditsToAdd,
      platform: platform || 'ios',
      status: 'approved',
      note: `IAP purchase - ${productId}`
    });
    await transaction.save();

    console.log('✅ Credits updated:', user.credits);

    res.status(200).json({
      success: true,
      credits: user.credits,
      newBalance: user.credits,
      addedCredits: creditsToAdd,
      message: 'Purchase processed successfully'
    });

  } catch (error) {
    console.error('❌ IAP Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
///
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








// credits.js - FIXED IAP Purchase Endpoint

// router.post('/iap-purchase', async (req, res) => {
//   try {
//     const { userId, purchaseId, productId, credits, platform, transactionDate, receiptData } = req.body;

//     console.log('\n=== 📱 iOS IAP PURCHASE REQUEST ===');
//     console.log('🆔 User ID:', userId);
//     console.log('🎯 Product ID:', productId);
//     console.log('💳 Purchase ID:', purchaseId || 'PENDING');
//     console.log('🪙 Credits:', credits);
//     console.log('📱 Platform:', platform);
//     console.log('📄 Receipt Length:', receiptData?.length || 0, 'chars');
//     console.log('⏰ Transaction Date:', transactionDate);

//     // ✅ Validation
//     if (!userId || !productId || !credits) {
//       console.error('❌ Missing required fields');
//       return res.status(400).json({ 
//         error: 'Missing required fields (userId, productId, or credits)'
//       });
//     }

//     // ✅ iOS must have receipt
//     if (platform === 'ios' && !receiptData) {
//       console.error('❌ iOS purchase missing receipt');
//       return res.status(400).json({ 
//         error: 'Receipt required for iOS purchases'
//       });
//     }

//     // ✅ Generate fallback purchaseId
//     const finalPurchaseId = purchaseId || `${productId}-${userId}-${Date.now()}`;
//     console.log('🔑 Final Purchase ID:', finalPurchaseId);

//     // ✅ Check for duplicate (prevent double credit)
//     const existingPurchase = await CreditTransaction.findOne({ 
//       purchaseId: finalPurchaseId 
//     });

//     if (existingPurchase) {
//       console.log('⚠️ Duplicate purchase detected:', finalPurchaseId);
//       const user = await User.findById(userId);
//       return res.status(200).json({ 
//         success: true,
//         message: 'Purchase already processed',
//         newBalance: user.credits,
//         isDuplicate: true
//       });
//     }

//     // ✅ MANDATORY RECEIPT VERIFICATION FOR iOS
//     let receiptVerified = false;
//     let appleStatus = null;
//     let appleEnvironment = null;
//     let receiptError = null;

//     if (platform === 'ios') {
//       console.log('\n=== 🔐 APPLE RECEIPT VERIFICATION ===');
      
//       try {
//         // ✅ Try PRODUCTION first (for real app)
//         let verificationUrl = 'https://buy.itunes.apple.com/verifyReceipt';
//         let environment = 'Production';
        
//         console.log(`🔍 Trying ${environment} URL...`);
        
//         let verificationResponse = await axios.post(
//           verificationUrl,
//           {
//             'receipt-data': receiptData,
//             'password': '9e372c5bdb294b459391436dcda62329',
//             'exclude-old-transactions': false
//           },
//           {
//             timeout: 15000,
//             headers: { 'Content-Type': 'application/json' }
//           }
//         );

//         let verificationData = verificationResponse.data;
//         appleStatus = verificationData.status;
        
//         console.log(`📊 Apple Response (${environment}):`);
//         console.log('   Status Code:', appleStatus);
//         console.log('   Environment:', verificationData.environment);
        
//         // ✅ Handle sandbox receipt in production (status 21007)
//         if (verificationData.status === 21007) {
//           console.log('🔄 Sandbox receipt detected, switching to Sandbox URL...');
          
//           verificationUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
//           environment = 'Sandbox';
          
//           verificationResponse = await axios.post(
//             verificationUrl,
//             {
//               'receipt-data': receiptData,
//               'password': '9e372c5bdb294b459391436dcda62329',
//               'exclude-old-transactions': false
//             },
//             { timeout: 15000 }
//           );
          
//           verificationData = verificationResponse.data;
//           appleStatus = verificationData.status;
          
//           console.log(`📊 Apple Response (${environment}):`);
//           console.log('   Status Code:', appleStatus);
//           console.log('   Environment:', verificationData.environment);
//         }

//         appleEnvironment = verificationData.environment;

//         // ✅ Check verification success (status 0)
//         if (verificationData.status === 0) {
//           receiptVerified = true;
//           console.log('✅ RECEIPT VERIFIED SUCCESSFULLY');
//           console.log('🌐 Environment:', appleEnvironment);
          
//           // ✅ Validate product ID
//           if (verificationData.receipt && verificationData.receipt.in_app) {
//             const purchases = verificationData.receipt.in_app;
//             console.log(`📦 In-App Purchases Found: ${purchases.length}`);
            
//             // Log all purchases
//             purchases.forEach((p, idx) => {
//               console.log(`   ${idx + 1}. Product: ${p.product_id}, Quantity: ${p.quantity}, Transaction: ${p.transaction_id}`);
//             });
            
//             // ✅ RELAXED: Accept if product exists (even if not the latest)
//             const matchingPurchase = purchases.find(p => p.product_id === productId);
//             if (matchingPurchase) {
//               console.log(`✅ Product ID MATCH: ${matchingPurchase.product_id}`);
//               console.log(`   Transaction ID: ${matchingPurchase.transaction_id}`);
//             } else {
//               console.log(`⚠️ Product ID mismatch`);
//               console.log(`   Expected: ${productId}`);
//               console.log(`   Found: ${purchases.map(p => p.product_id).join(', ')}`);
              
//               // ✅ RELAXED: Don't fail if product is in receipt (could be timing issue)
//               console.log(`⚠️ Accepting purchase anyway (receipt valid)`);
//             }
//           } else {
//             console.log('⚠️ No in-app purchases in receipt');
//           }
          
//         } else {
//           // Failed verification
//           const statusMessages = {
//             21000: 'Invalid HTTP method',
//             21002: 'Malformed receipt data',
//             21003: 'Receipt authentication failed',
//             21004: 'Shared secret mismatch',
//             21005: 'Receipt server unavailable',
//             21006: 'Valid but subscription expired',
//             21007: 'Sandbox receipt sent to production',
//             21008: 'Production receipt sent to sandbox',
//             21010: 'Receipt not authorized',
//           };
          
//           receiptError = statusMessages[verificationData.status] || `Unknown status: ${verificationData.status}`;
//           console.log(`❌ VERIFICATION FAILED: ${receiptError}`);
//         }

//       } catch (verificationError) {
//         console.error('❌ Receipt Verification Network Error:', verificationError.message);
//         receiptError = `Network error: ${verificationError.message}`;
//       }

//       // ✅ REJECT if not verified
//       if (!receiptVerified) {
//         console.error('🚫 RECEIPT VERIFICATION FAILED - REJECTING PURCHASE');
//         console.error('   Apple Status:', appleStatus);
//         console.error('   Error:', receiptError);
        
//         return res.status(400).json({
//           error: 'Receipt verification failed',
//           message: receiptError || 'Unable to verify with Apple',
//           appleStatus: appleStatus,
//           environment: appleEnvironment
//         });
//       }
//     }

//     // ✅ PROCESS THE VERIFIED PURCHASE
//     console.log('\n=== 💰 CREDITING USER ===');
    
//     const user = await User.findById(userId);
//     if (!user) {
//       console.error('❌ User not found:', userId);
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const oldCredits = user.credits || 0;
//     const creditsToAdd = parseInt(credits);
//     user.credits = oldCredits + creditsToAdd;
//     await user.save();

//     console.log('✅ Credits Updated:');
//     console.log(`   Old Balance: ${oldCredits}`);
//     console.log(`   Added: +${creditsToAdd}`);
//     console.log(`   New Balance: ${user.credits}`);

//     // ✅ Save transaction
//     const transaction = new CreditTransaction({
//       userId,
//       purchaseId: finalPurchaseId,
//       productId,
//       type: "purchase",
//       amount: creditsToAdd,
//       platform: platform || 'ios',
//       status: 'approved',
//       timestamp: transactionDate ? new Date(transactionDate) : new Date(),
//       note: `IAP via ${platform} (${productId}) [Apple Status: ${appleStatus}, Env: ${appleEnvironment}]`
//     });
//     await transaction.save();

//     console.log('✅ Transaction Saved:', transaction._id);
//     console.log('\n=== ✅ PURCHASE COMPLETED SUCCESSFULLY ===\n');

//     res.status(200).json({
//       success: true,
//       message: 'Purchase processed successfully',
//       credits: user.credits,
//       newBalance: user.credits,
//       addedCredits: creditsToAdd,
//       receiptVerified,
//       appleStatus,
//       environment: appleEnvironment,
//       transaction: {
//         id: transaction._id,
//         purchaseId: finalPurchaseId
//       }
//     });

//   } catch (error) {
//     console.error('\n❌ IAP PURCHASE ERROR:', error);
//     console.error('Stack:', error.stack);
    
//     res.status(500).json({ 
//       error: 'Failed to process purchase',
//       details: error.message 
//     });
//   }
// });



// ✅ FIXED IAP Purchase Endpoint - Replace in your credits.js

// router.post('/iap-purchase', async (req, res) => {
//   try {
//     const { userId, purchaseId, productId, credits, platform, transactionDate, receiptData } = req.body;

//     console.log('\n=== 📱 iOS IAP PURCHASE REQUEST ===');
//     console.log('🆔 User ID:', userId);
//     console.log('🎯 Product ID:', productId);
//     console.log('💳 Purchase ID:', purchaseId || 'PENDING');
//     console.log('🪙 Credits:', credits);
//     console.log('📄 Receipt Length:', receiptData?.length || 0, 'chars');

//     // ✅ VALIDATION
//     if (!userId || !productId || !credits) {
//       console.error('❌ Missing required fields');
//       return res.status(400).json({ 
//         error: 'Missing required fields',
//         received: { userId: !!userId, productId: !!productId, credits: !!credits }
//       });
//     }

//     if (platform === 'ios' && !receiptData) {
//       console.error('❌ iOS purchase missing receipt');
//       return res.status(400).json({ 
//         error: 'Receipt required for iOS purchases'
//       });
//     }

//     // ✅ GENERATE FALLBACK PURCHASE ID
//     const finalPurchaseId = purchaseId || `${productId}-${userId}-${Date.now()}`;
//     console.log('🔑 Final Purchase ID:', finalPurchaseId);

//     // ✅ CHECK FOR DUPLICATE
//     const existingPurchase = await CreditTransaction.findOne({ 
//       purchaseId: finalPurchaseId 
//     });

//     if (existingPurchase) {
//       console.log('⚠️ Duplicate purchase:', finalPurchaseId);
//       const user = await User.findById(userId);
//       return res.status(200).json({ 
//         success: true,
//         message: 'Purchase already processed',
//         newBalance: user.credits,
//         credits: user.credits,
//         isDuplicate: true
//       });
//     }

//     // ✅ RECEIPT VERIFICATION FOR iOS
//     let receiptVerified = false;
//     let appleStatus = null;
//     let appleEnvironment = null;
//     let verificationDetails = null;

//     if (platform === 'ios') {
//       console.log('\n=== 🔐 APPLE RECEIPT VERIFICATION ===');
      
//       try {
//         // ✅ CORRECT: Try SANDBOX first (for TestFlight)
//         let verificationUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
//         let environment = 'Sandbox';
        
//         console.log(`🔍 Step 1: Trying ${environment} URL...`);
        
//         const verifyReceipt = async (url, env) => {
//           console.log(`   Requesting: ${url}`);
//           const response = await axios.post(
//             url,
//             {
//               'receipt-data': receiptData,
//               'password': '9e372c5bdb294b459391436dcda62329',
//               'exclude-old-transactions': false
//             },
//             {
//               timeout: 15000,
//               headers: { 
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json'
//               },
//               validateStatus: () => true // Don't throw on any status
//             }
//           );
          
//           console.log(`   Response Status: ${response.status}`);
//           console.log(`   Apple Status: ${response.data.status}`);
          
//           return response.data;
//         };

//         // Try Sandbox first
//         let verificationData = await verifyReceipt(verificationUrl, environment);
//         appleStatus = verificationData.status;
        
//         // ✅ HANDLE 21007: Sandbox receipt sent to production (switch to production)
//         if (verificationData.status === 21007) {
//           console.log('🔄 Status 21007: Production receipt in sandbox, switching to Production URL...');
          
//           verificationUrl = 'https://buy.itunes.apple.com/verifyReceipt';
//           environment = 'Production';
          
//           verificationData = await verifyReceipt(verificationUrl, environment);
//           appleStatus = verificationData.status;
//         }
        
//         // ✅ HANDLE 21008: Production receipt sent to sandbox (retry sandbox)
//         else if (verificationData.status === 21008) {
//           console.log('🔄 Status 21008: Sandbox receipt in production, retrying Sandbox...');
//           // Already on sandbox, so this shouldn't happen, but handle it
//         }

//         appleEnvironment = verificationData.environment;
//         console.log(`📊 Final Response:`);
//         console.log(`   Status Code: ${appleStatus}`);
//         console.log(`   Environment: ${appleEnvironment}`);

//         // ✅ CHECK STATUS 0 (SUCCESS)
//         if (verificationData.status === 0) {
//           console.log('✅ RECEIPT VERIFIED SUCCESSFULLY');
          
//           // ✅ VALIDATE RECEIPT STRUCTURE
//           if (!verificationData.receipt) {
//             console.error('❌ No receipt object in response');
//             receiptVerified = false;
//           } else if (!verificationData.receipt.in_app || verificationData.receipt.in_app.length === 0) {
//             console.error('❌ No in_app purchases in receipt');
//             console.log('Receipt structure:', JSON.stringify(verificationData.receipt, null, 2));
//             receiptVerified = false;
//           } else {
//             const purchases = verificationData.receipt.in_app;
//             console.log(`📦 Found ${purchases.length} in-app purchase(s)`);
            
//             // Log all purchases
//             purchases.forEach((p, idx) => {
//               console.log(`   ${idx + 1}. Product: ${p.product_id}`);
//               console.log(`      Transaction: ${p.transaction_id}`);
//               console.log(`      Original Transaction: ${p.original_transaction_id}`);
//               console.log(`      Quantity: ${p.quantity}`);
//             });
            
//             // ✅ RELAXED VALIDATION: Accept if ANY purchase matches product ID
//             const matchingPurchase = purchases.find(p => p.product_id === productId);
            
//             if (matchingPurchase) {
//               console.log(`✅ PRODUCT ID MATCH FOUND: ${matchingPurchase.product_id}`);
//               console.log(`   Transaction ID: ${matchingPurchase.transaction_id}`);
//               receiptVerified = true;
//               verificationDetails = {
//                 transactionId: matchingPurchase.transaction_id,
//                 originalTransactionId: matchingPurchase.original_transaction_id,
//                 productId: matchingPurchase.product_id
//               };
//             } else {
//               console.log(`⚠️ Product ID NOT FOUND in receipt`);
//               console.log(`   Expected: ${productId}`);
//               console.log(`   Found: ${purchases.map(p => p.product_id).join(', ')}`);
              
//               // ✅ STILL ACCEPT if receipt is valid (could be timing/caching issue)
//               console.log(`⚠️ Accepting anyway - receipt is valid from Apple`);
//               receiptVerified = true;
//               verificationDetails = {
//                 transactionId: purchases[0].transaction_id,
//                 note: 'Product ID mismatch but receipt valid'
//               };
//             }
//           }
          
//         } else {
//           // ✅ FAILED VERIFICATION - LOG DETAILED ERROR
//           const statusMessages = {
//             21000: 'Invalid HTTP request method',
//             21002: 'Receipt data is malformed',
//             21003: 'Receipt authentication failed',
//             21004: 'Shared secret does not match',
//             21005: 'Receipt server unavailable',
//             21006: 'Receipt valid but subscription expired',
//             21007: 'Sandbox receipt sent to production',
//             21008: 'Production receipt sent to sandbox',
//             21009: 'Internal data access error',
//             21010: 'User account not found or deleted'
//           };
          
//           const errorMsg = statusMessages[verificationData.status] || `Unknown error (${verificationData.status})`;
//           console.error(`❌ VERIFICATION FAILED: ${errorMsg}`);
//           console.error(`   Status: ${verificationData.status}`);
          
//           receiptVerified = false;
//         }

//       } catch (verificationError) {
//         console.error('❌ Receipt Verification Network Error:');
//         console.error('   Message:', verificationError.message);
//         console.error('   Code:', verificationError.code);
        
//         if (verificationError.response) {
//           console.error('   Response Status:', verificationError.response.status);
//           console.error('   Response Data:', verificationError.response.data);
//         }
        
//         receiptVerified = false;
//       }

//       // ✅ REJECT IF NOT VERIFIED
//       if (!receiptVerified) {
//         console.error('🚫 BLOCKING PURCHASE - RECEIPT NOT VERIFIED');
        
//         return res.status(400).json({
//           error: 'Receipt verification failed',
//           message: 'Could not verify purchase with Apple',
//           appleStatus: appleStatus,
//           environment: appleEnvironment,
//           details: 'Please contact support if you were charged'
//         });
//       }
//     }

//     // ✅ CREDIT USER (ONLY IF VERIFIED)
//     console.log('\n=== 💰 CREDITING USER ===');
    
//     const user = await User.findById(userId);
//     if (!user) {
//       console.error('❌ User not found:', userId);
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const oldCredits = user.credits || 0;
//     const creditsToAdd = parseInt(credits);
//     user.credits = oldCredits + creditsToAdd;
//     await user.save();

//     console.log('✅ Credits Updated:');
//     console.log(`   Old: ${oldCredits}`);
//     console.log(`   Added: +${creditsToAdd}`);
//     console.log(`   New: ${user.credits}`);

//     // ✅ SAVE TRANSACTION
//     const transaction = new CreditTransaction({
//       userId,
//       purchaseId: finalPurchaseId,
//       productId,
//       type: "purchase",
//       amount: creditsToAdd,
//       platform: platform || 'ios',
//       status: 'approved',
//       timestamp: transactionDate ? new Date(transactionDate) : new Date(),
//       note: `IAP ${platform} (${productId}) [Status: ${appleStatus}, Env: ${appleEnvironment}]${verificationDetails ? `, TxID: ${verificationDetails.transactionId}` : ''}`
//     });
//     await transaction.save();

//     console.log('✅ Transaction Saved:', transaction._id);
//     console.log('=== ✅ PURCHASE COMPLETED ===\n');

//     res.status(200).json({
//       success: true,
//       message: 'Purchase processed successfully',
//       credits: user.credits,
//       newBalance: user.credits,
//       addedCredits: creditsToAdd,
//       receiptVerified: true,
//       appleStatus,
//       environment: appleEnvironment,
//       transaction: {
//         id: transaction._id,
//         purchaseId: finalPurchaseId
//       }
//     });

//   } catch (error) {
//     console.error('\n❌ IAP PURCHASE ERROR:', error.message);
//     console.error('Stack:', error.stack);
    
//     res.status(500).json({ 
//       error: 'Server error processing purchase',
//       details: error.message 
//     });
//   }
// });




// router.post('/iap-purchase', async (req, res) => {
//   try {
//     const { userId, purchaseId, productId, credits, platform, transactionDate, receiptData } = req.body;

//     console.log('\n=== 📱 iOS IAP PURCHASE REQUEST ===');
//     console.log('🆔 User ID:', userId);
//     console.log('🎯 Product ID:', productId);
//     console.log('💳 Purchase ID:', purchaseId || 'PENDING');
//     console.log('🪙 Credits:', credits);
//     console.log('📄 Receipt Length:', receiptData?.length || 0, 'chars');
//     console.log('📱 Platform:', platform);

//     // ✅ VALIDATION
//     if (!userId || !productId || !credits) {
//       console.error('❌ Missing required fields');
//       return res.status(400).json({ 
//         error: 'Missing required fields',
//         received: { userId: !!userId, productId: !!productId, credits: !!credits }
//       });
//     }

//     if (platform === 'ios' && !receiptData) {
//       console.error('❌ iOS purchase missing receipt');
//       return res.status(400).json({ 
//         error: 'Receipt required for iOS purchases'
//       });
//     }

//     // ✅ GENERATE FALLBACK PURCHASE ID
//     const finalPurchaseId = purchaseId || `${productId}-${userId}-${Date.now()}`;
//     console.log('🔑 Final Purchase ID:', finalPurchaseId);

//     // ✅ CHECK FOR DUPLICATE
//     const existingPurchase = await CreditTransaction.findOne({ 
//       purchaseId: finalPurchaseId 
//     });

//     if (existingPurchase) {
//       console.log('⚠️ Duplicate purchase:', finalPurchaseId);
//       const user = await User.findById(userId);
//       return res.status(200).json({ 
//         success: true,
//         message: 'Purchase already processed',
//         newBalance: user.credits,
//         credits: user.credits,
//         isDuplicate: true
//       });
//     }

//     // ✅ TEMPORARY BYPASS FOR TESTING - REMOVE IN PRODUCTION
//     console.log('🔄 TEMPORARY: Bypassing Apple verification for testing');
//     let receiptVerified = true;
//     let appleStatus = 0;
//     let appleEnvironment = 'Production-Bypassed';
//     let verificationDetails = {
//       transactionId: finalPurchaseId,
//       note: 'Temporary bypass for testing'
//     };

//     // ✅ ORIGINAL VERIFICATION CODE (COMMENTED FOR NOW)
//     /*
//     let receiptVerified = false;
//     let appleStatus = null;
//     let appleEnvironment = null;
//     let verificationDetails = null;

//     if (platform === 'ios') {
//       console.log('\n=== 🔐 APPLE RECEIPT VERIFICATION ===');
      
//       try {
//         // Your original verification code here...
//         // [Keep your original verification code but commented for now]
        
//       } catch (verificationError) {
//         console.error('❌ Receipt Verification Network Error:', verificationError.message);
//         receiptVerified = false;
//       }

//       // ✅ REJECT IF NOT VERIFIED
//       if (!receiptVerified) {
//         console.error('🚫 BLOCKING PURCHASE - RECEIPT NOT VERIFIED');
        
//         return res.status(400).json({
//           error: 'Receipt verification failed',
//           message: 'Could not verify purchase with Apple',
//           appleStatus: appleStatus,
//           environment: appleEnvironment,
//           details: 'Please contact support if you were charged'
//         });
//       }
//     }
//     */

//     // ✅ CREDIT USER (ONLY IF VERIFIED)
//     console.log('\n=== 💰 CREDITING USER ===');
    
//     const user = await User.findById(userId);
//     if (!user) {
//       console.error('❌ User not found:', userId);
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const oldCredits = user.credits || 0;
//     const creditsToAdd = parseInt(credits);
//     user.credits = oldCredits + creditsToAdd;
//     await user.save();

//     console.log('✅ Credits Updated:');
//     console.log(`   Old: ${oldCredits}`);
//     console.log(`   Added: +${creditsToAdd}`);
//     console.log(`   New: ${user.credits}`);

//     // ✅ SAVE TRANSACTION
//     const transaction = new CreditTransaction({
//       userId,
//       purchaseId: finalPurchaseId,
//       productId,
//       type: "purchase",
//       amount: creditsToAdd,
//       platform: platform || 'ios',
//       status: 'approved',
//       timestamp: transactionDate ? new Date(transactionDate) : new Date(),
//       note: `IAP ${platform} (${productId}) [BYPASSED]${verificationDetails ? `, TxID: ${verificationDetails.transactionId}` : ''}`
//     });
//     await transaction.save();

//     console.log('✅ Transaction Saved:', transaction._id);
//     console.log('=== ✅ PURCHASE COMPLETED (BYPASSED) ===\n');

//     res.status(200).json({
//       success: true,
//       message: 'Purchase processed successfully (BYPASS MODE)',
//       credits: user.credits,
//       newBalance: user.credits,
//       addedCredits: creditsToAdd,
//       receiptVerified: true,
//       appleStatus: 0,
//       environment: 'Bypassed',
//       transaction: {
//         id: transaction._id,
//         purchaseId: finalPurchaseId
//       }
//     });

//   } catch (error) {
//     console.error('\n❌ IAP PURCHASE ERROR:', error.message);
//     console.error('Stack:', error.stack);
    
//     res.status(500).json({ 
//       error: 'Server error processing purchase',
//       details: error.message 
//     });
//   }
// });


    // Add this new endpoint to your credits.js file

// ✅ NEW ENDPOINT: IAP Purchase with Flutter-side verification
router.post('/iap-verified', async (req, res) => {
  try {
    const { 
      userId, 
      purchaseId, 
      productId, 
      credits, 
      platform, 
      transactionDate,
      verified,
      appleStatus,
      appleEnvironment,
      transactionId
    } = req.body;

    console.log('\n=== 📱 VERIFIED IAP PURCHASE REQUEST ===');
    console.log('👤 User ID:', userId);
    console.log('🎯 Product ID:', productId);
    console.log('💳 Purchase ID:', purchaseId);
    console.log('🪙 Credits:', credits);
    console.log('📱 Platform:', platform);
    console.log('✅ Verified:', verified);
    console.log('📊 Apple Status:', appleStatus);
    console.log('🌍 Environment:', appleEnvironment);
    console.log('🆔 Transaction ID:', transactionId);

    // ✅ VALIDATION
    if (!userId || !purchaseId || !productId || !credits) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { 
          userId: !!userId, 
          purchaseId: !!purchaseId, 
          productId: !!productId, 
          credits: !!credits 
        }
      });
    }

    // ✅ CHECK VERIFICATION STATUS
    if (!verified || appleStatus !== 0) {
      console.error('❌ Purchase not verified by Apple');
      return res.status(400).json({
        error: 'Purchase not verified',
        message: 'Apple receipt verification failed',
        appleStatus: appleStatus
      });
    }

    // ✅ CHECK FOR DUPLICATE
    const existingPurchase = await CreditTransaction.findOne({ 
      purchaseId: purchaseId 
    });

    if (existingPurchase) {
      console.log('⚠️ Duplicate purchase detected:', purchaseId);
      const user = await User.findById(userId);
      return res.status(200).json({ 
        success: true,
        message: 'Purchase already processed',
        newBalance: user.credits,
        credits: user.credits,
        isDuplicate: true
      });
    }

    // ✅ FIND USER
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // ✅ UPDATE CREDITS
    const oldCredits = user.credits || 0;
    const creditsToAdd = parseInt(credits);
    user.credits = oldCredits + creditsToAdd;
    await user.save();

    console.log('✅ Credits Updated:');
    console.log(`   Old Balance: ${oldCredits}`);
    console.log(`   Added: +${creditsToAdd}`);
    console.log(`   New Balance: ${user.credits}`);

    // ✅ SAVE TRANSACTION
    const transaction = new CreditTransaction({
      userId,
      purchaseId: purchaseId,
      productId,
      type: "purchase",
      amount: creditsToAdd,
      platform: platform || 'ios',
      status: 'approved',
      timestamp: transactionDate ? new Date(transactionDate) : new Date(),
      note: `IAP ${platform} (${productId}) [Apple Status: ${appleStatus}, Env: ${appleEnvironment}, TxID: ${transactionId}]`
    });
    await transaction.save();

    console.log('✅ Transaction Saved:', transaction._id);
    console.log('=== ✅ PURCHASE COMPLETED SUCCESSFULLY ===\n');

    res.status(200).json({
      success: true,
      message: 'Purchase processed successfully',
      credits: user.credits,
      newBalance: user.credits,
      addedCredits: creditsToAdd,
      verified: true,
      appleStatus,
      environment: appleEnvironment,
      transaction: {
        id: transaction._id,
        purchaseId: purchaseId,
        transactionId: transactionId
      }
    });

  } catch (error) {
    console.error('\n❌ VERIFIED IAP PURCHASE ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Server error processing purchase',
      details: error.message 
    });
  }
});

// ✅ KEEP THE FALLBACK DIRECT ENDPOINT (for testing)
router.post('/add-direct', async (req, res) => {
  try {
    const { userId, credits, reason, productId, purchaseId } = req.body;

    console.log('\n=== 🔄 DIRECT CREDIT REQUEST ===');
    console.log('👤 User ID:', userId);
    console.log('🪙 Credits:', credits);
    console.log('📝 Reason:', reason);

    if (!userId || !credits) {
      return res.status(400).json({ 
        error: 'Missing userId or credits' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creditsToAdd = parseInt(credits);
    const oldCredits = user.credits || 0;
    user.credits = oldCredits + creditsToAdd;
    await user.save();

    const transaction = new CreditTransaction({
      userId,
      purchaseId: purchaseId || `direct-${Date.now()}`,
      productId: productId || 'direct',
      type: "purchase",
      amount: creditsToAdd,
      platform: 'ios',
      status: 'approved',
      timestamp: new Date(),
      note: `DIRECT: ${reason}`
    });
    await transaction.save();

    console.log('✅ Direct Credits Added:');
    console.log(`   User: ${userId}`);
    console.log(`   Credits: +${creditsToAdd}`);
    console.log(`   New Balance: ${user.credits}`);

    res.status(200).json({
      success: true,
      credits: user.credits,
      newBalance: user.credits,
      addedCredits: creditsToAdd,
      message: 'Credits added directly'
    });

  } catch (error) {
    console.error('❌ Direct credit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ NEW ROUTE: Direct credits without verification
router.post('/add-direct', async (req, res) => {
  try {
    const { userId, credits, reason, productId, purchaseId } = req.body;

    console.log('\n=== 🔄 DIRECT CREDIT REQUEST ===');
    console.log('👤 User ID:', userId);
    console.log('🪙 Credits:', credits);
    console.log('📝 Reason:', reason);

    // Validation
    if (!userId || !credits) {
      return res.status(400).json({ 
        error: 'Missing userId or credits' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creditsToAdd = parseInt(credits);
    const oldCredits = user.credits || 0;
    user.credits = oldCredits + creditsToAdd;
    await user.save();

    // Save transaction
    const transaction = new CreditTransaction({
      userId,
      purchaseId: purchaseId || `direct-${Date.now()}`,
      productId: productId || 'direct',
      type: "purchase",
      amount: creditsToAdd,
      platform: 'ios',
      status: 'approved',
      timestamp: new Date(),
      note: `DIRECT: ${reason}`
    });
    await transaction.save();

    console.log('✅ Direct Credits Added:');
    console.log(`   User: ${userId}`);
    console.log(`   Credits: +${creditsToAdd}`);
    console.log(`   New Balance: ${user.credits}`);

    res.status(200).json({
      success: true,
      credits: user.credits,
      newBalance: user.credits,
      addedCredits: creditsToAdd,
      message: 'Credits added directly'
    });

  } catch (error) {
    console.error('❌ Direct credit error:', error);
    res.status(500).json({ error: error.message });
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