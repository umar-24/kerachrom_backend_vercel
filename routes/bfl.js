// import express from "express";
// import fetch from "node-fetch"; // agar node <18 ho

// const router = express.Router();

// const BFL_API_BASE = "https://api.bfl.ai/v1/flux-kontext-pro";
// const BFL_API_KEY = process.env.BFL_API_KEY;

// // 1) Enhance
// router.post("/enhance", async (req, res) => {
//   try {
//     const resp = await fetch(BFL_API_BASE, {
//       method: "POST",
//       headers: {
//         "accept": "application/json",
//         "content-type": "application/json",
//         "x-key": BFL_API_KEY,
//       },
//       body: JSON.stringify(req.body),
//     });
//     const text = await resp.text();
//     res.status(resp.status).type("application/json").send(text);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Proxy enhance failed." });
//   }
// });

// // 2) Poll
// router.get("/poll", async (req, res) => {
//   try {
//     const url = req.query.u;
//     const resp = await fetch(url, {
//       headers: { "accept": "application/json", "x-key": BFL_API_KEY },
//     });
//     const text = await resp.text();
//     res.status(resp.status).type("application/json").send(text);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Proxy poll failed." });
//   }
// });

// // 3) Download
// router.get("/download", async (req, res) => {
//   try {
//     const url = req.query.u;
//     const resp = await fetch(url);
//     if (!resp.ok) {
//       return res.status(resp.status).json({ error: "Download failed." });
//     }
//     const buf = Buffer.from(await resp.arrayBuffer());
//     res.setHeader("Content-Type", resp.headers.get("content-type") || "image/jpeg");
//     res.send(buf);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Proxy download failed." });
//   }
// });

// export default router;



const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

const BFL_API_BASE = "https://api.bfl.ai/v1/flux-kontext-pro";
const BFL_API_KEY = process.env.BFL_API_KEY || "1c5f81aa-279c-429b-92a0-57a5520512de"; // Your API key here

// 1) Create enhancement request
router.post("/enhance", async (req, res) => {
  try {
    console.log("Enhancement request received");
    
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

// 2) Poll for results
router.get("/poll", async (req, res) => {
  try {
    const pollingUrl = req.query.url;
    
    if (!pollingUrl) {
      return res.status(400).json({ error: "Polling URL is required" });
    }

    console.log("Polling URL:", pollingUrl);

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

// 3) Download enhanced image
router.get("/download", async (req, res) => {
  try {
    const downloadUrl = req.query.url;
    
    if (!downloadUrl) {
      return res.status(400).json({ error: "Download URL is required" });
    }

    console.log("Downloading from URL:", downloadUrl);

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

module.exports = router;