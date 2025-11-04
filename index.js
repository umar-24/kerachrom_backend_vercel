// const dotenv = require("dotenv");

// const express = require("express");
// const mongoose = require("mongoose");

// const authRouter = require("./routes/auth");
// const orderRouter = require("./routes/order"); // Import order routes
// const templateRouter = require("./routes/templates_route"); // Import order routes
// const shapeRoutes = require("./routes/shapes");
// const bgRouter = require("./routes/bg_images_route");
// const categoryRoutes = require("./routes/bg_catg");
// const creditRoutes = require("./routes/credits");
// const router = require("./routes/pdf_mail");
// const cors = require("cors");
// const paypalRoutes = require("./routes/paypal");
// // const braintreeRoutes = require("./routes/braintree");

// dotenv.config();

// const PORT = process.env.PORT || 5000;
// const DB = process.env.MONGO_URI;

// const app = express();

// app.use(cors()); // Allow all origins (for development)
// app.use(express.json());

// // Register routes
// app.use(authRouter);
// app.use(orderRouter); // Use order routes
// app.use(templateRouter);
// app.use(shapeRoutes);
// app.use(bgRouter);
// app.use(categoryRoutes);
// app.use("/api/credits", creditRoutes);
// app.use(router);
// app.use("/api/paypal", paypalRoutes);
// // app.use("/api/braintree", braintreeRoutes);


// // ✅ Fix CORS issue

// mongoose
//   .connect(DB)
//   .then(() => {
//     console.log("MongoDB Connected");
//   })
//   .catch((error) => {
//     console.error("MongoDB Connection Error:", error);
//   });

// app.get("/", (req, res) => {
//   res.send("Hello, this is the Kerachrom API!");
// });

// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`The server is running on port ${PORT}`);
// });









// ====================== Complete index.js with BFL routes ======================
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require('body-parser');


// Import all routes
const authRouter = require("./routes/auth");
const orderRouter = require("./routes/order");
const templateRouter = require("./routes/templates_route");
const shapeRoutes = require("./routes/shapes");
const bgRouter = require("./routes/bg_images_route");
const categoryRoutes = require("./routes/bg_catg");
const creditRoutes = require("./routes/credits");
const router = require("./routes/pdf_mail");
const paypalRoutes = require("./routes/paypal");
const userRoutes = require("./routes/user.routes");
app.use("/api", userRoutes);

// CORS package
const cors = require("cors");

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const DB = process.env.MONGO_URI;

const app = express();

// ====================== CORS FIX ======================
// This will fix all CORS issues for development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-key');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Additional CORS setup
app.use(cors({
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200
}));

// ====================== MIDDLEWARE ======================
app.use(express.json({ limit: '100mb' })); // Increased limit for images
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// If using body-parser separately:
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ====================== BFL ROUTES (Add this before other routes) ======================
// BFL Image Enhancement Routes
app.post('/api/bfl/enhance', async (req, res) => {
  try {
    console.log('BFL Enhancement request received');
    
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const BFL_API_BASE = "https://api.bfl.ai/v1/flux-kontext-pro";
    const BFL_API_KEY = process.env.BFL_API_KEY || "1c5f81aa-279c-429b-92a0-57a5520512de";
    
    
    const response = await fetch(BFL_API_BASE, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-key": BFL_API_KEY,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      console.error("BFL API Error:", response.status, response.statusText);
      return res.status(response.status).json({
        error: `BFL API Error: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json();
    console.log("Enhancement request successful:", data);
    res.json(data);

  } catch (error) {
    console.error("Enhancement proxy error:", error);
    res.status(500).json({ 
      error: "Enhancement request failed",
      details: error.message 
    });
  }
});

// BFL Poll Route
app.get('/api/bfl/poll', async (req, res) => {
  try {
    const pollingUrl = req.query.url;
    
    if (!pollingUrl) {
      return res.status(400).json({ error: "Polling URL is required" });
    }

    console.log("Polling URL:", pollingUrl);

    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const BFL_API_KEY = process.env.BFL_API_KEY || "1c5f81aa-279c-429b-92a0-57a5520512de";

    const response = await fetch(pollingUrl, {
      headers: { 
        "accept": "application/json", 
        "x-key": BFL_API_KEY 
      },
    });

    if (!response.ok) {
      console.error("Polling Error:", response.status, response.statusText);
      return res.status(response.status).json({
        error: `Polling Error: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json();
    console.log("Polling response:", data);
    res.json(data);

  } catch (error) {
    console.error("Polling proxy error:", error);
    res.status(500).json({ 
      error: "Polling request failed",
      details: error.message 
    });
  }
});


// BFL Download Route
app.get('/api/bfl/download', async (req, res) => {
  try {
    const downloadUrl = req.query.url;
    
    if (!downloadUrl) {
      return res.status(400).json({ error: "Download URL is required" });
    }

    console.log("Downloading from URL:", downloadUrl);

    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      console.error("Download Error:", response.status, response.statusText);
      return res.status(response.status).json({
        error: `Download Error: ${response.status} ${response.statusText}`
      });
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error("Download proxy error:", error);
    res.status(500).json({ 
      error: "Download request failed",
      details: error.message 
    });
  }
});

// ====================== OTHER ROUTES ======================
app.use(authRouter);
app.use(orderRouter);
app.use(templateRouter);
app.use(shapeRoutes);
app.use(bgRouter);
app.use(categoryRoutes);
app.use("/api/credits", creditRoutes);
app.use(router);
app.use("/api/paypal", paypalRoutes);

// ====================== DATABASE CONNECTION ======================
mongoose
  .connect(DB)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error);
  });

// ====================== ROOT ROUTE ======================
app.get("/", (req, res) => {
  res.json({
    message: "Hello, this is the Kerachrom API!",
    status: "Server is running",
    bfl_routes: {
      enhance: "/api/bfl/enhance",
      poll: "/api/bfl/poll", 
      download: "/api/bfl/download"
    }
  });
});

// ====================== START SERVER ======================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 The server is running on port ${PORT}`);
  console.log(`📱 BFL Image Enhancement API is ready!`);
  console.log(`🌐 CORS enabled for all origins in development mode`);
});