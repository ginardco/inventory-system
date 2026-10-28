
const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        success: false,
        reply: "Please enter a message.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing.");
      return res.status(500).json({
        success: false,
        reply: "Gemini is not configured. Please check the backend environment variables.",
      });
    }

    // Load the official Gemini SDK (compatible with CommonJS projects).
    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Get actual inventory data from MongoDB.
    const products = await Product.find()
      .select("name category price quantity")
      .lean();

    const inventory = products.map((product) => ({
      name: product.name,
      category: product.category,
      price: Number(product.price) || 0,
      quantity: Number(product.quantity) || 0,
    }));

    const totalUnits = inventory.reduce(
      (total, product) => total + product.quantity,
      0
    );

    const inventoryValue = inventory.reduce(
      (total, product) =>
        total + product.price * product.quantity,
      0
    );

    // Keep stock thresholds consistent with the dashboard.
    const lowStock = inventory.filter(
      (product) =>
        product.quantity >= 10 && product.quantity <= 15
    );

    const criticalStock = inventory.filter(
      (product) => product.quantity >= 1 && product.quantity <= 9
    );

    const outOfStock = inventory.filter(
      (product) => product.quantity === 0
    );

    const systemInstruction = `
You are MotoAssist AI, the inventory assistant for MotorParts,
a motorcycle spare parts inventory management system.

Help users understand their inventory, stock levels, products,
and restocking needs. Be friendly, concise, and easy to understand.

IMPORTANT RULES:
1. Use the supplied MongoDB inventory data as the source of truth.
2. Never invent product names, quantities, prices, or sales figures.
3. Do not claim to know sales trends because this request contains
   inventory data only, not historical sales records.
4. A quantity of 0 means Out of Stock.
5. A quantity from 1 to 9 means Critical Stock.
6. A quantity from 10 to 15 means Low Stock.
7. A quantity of 16 or more means In Stock.
8. Inventory value is calculated using selling price multiplied
   by quantity. It is not profit or actual purchase cost.
9. You may suggest restocking, but clearly label suggestions as
   recommendations, not completed transactions.
10. If the data does not answer a question, say so honestly.
11. Format prices in Philippine pesos (₱).
12. Do not claim you have changed, added, or deleted products.
    Only the application can perform those operations.

CURRENT INVENTORY SUMMARY:
- Product types: ${inventory.length}
- Total units: ${totalUnits}
- Inventory selling value: ₱${inventoryValue.toFixed(2)}
- Low stock products (10-15 units): ${lowStock.length}
- Critical stock products (1-9 units): ${criticalStock.length}
- Out of stock products: ${outOfStock.length}

INVENTORY DATA:
${JSON.stringify(inventory)}
`;

    const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  contents: message,
  config: {
    systemInstruction,
    temperature: 0.3,
    maxOutputTokens: 800,
  },
});

    const reply =
      response.text?.trim() ||
      "Sorry, Gemini could not generate a response. Please try again.";

    return res.json({
      success: true,
      reply,
      answer: reply,
    });
  } catch (error) {
    console.error("MotoAssist Gemini error:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });

    return res.status(500).json({
      success: false,
      reply:
        "Sorry, MotoAssist could not process your request. Please check the Gemini API configuration and try again.",
    });
  }
});

module.exports = router;
