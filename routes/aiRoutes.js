
const express = require("express");
const OpenAI = require("openai");
const Product = require("../models/Product");

const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a question.",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Please keep your question under 2,000 characters.",
      });
    }

    const products = await Product.find()
      .select("name category price quantity")
      .lean();

    const inventorySummary = products.map((product) => ({
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      status:
        product.quantity === 0
          ? "Out of stock"
          : product.quantity < 10
            ? "Critical stock"
            : product.quantity < 16
              ? "Low stock"
              : "In stock",
    }));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      instructions: `
You are MotorParts AI, an assistant for a motorcycle spare-parts shop.

Help the user understand inventory, identify low-stock products,
suggest restocking priorities, explain sales and inventory concepts,
and answer questions clearly.

Use the inventory data provided in the user's message for inventory
questions. Do not invent product names, quantities, prices, or sales.
If the available data does not answer a question, say so clearly.

Stock rules:
- 16 or more units: In stock
- 10 to 15 units: Low stock
- 1 to 9 units: Critical stock
- 0 units: Out of stock

Give practical recommendations in simple language.
You cannot change inventory, record sales, or perform database actions.
      `,
      input: JSON.stringify({
        question: message.trim(),
        currentInventory: inventorySummary,
      }),
    });

    return res.json({
      success: true,
      reply: response.output_text || "I couldn't generate a response. Please try again.",
    });
  } catch (error) {
    console.error("AI assistant error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "The AI assistant could not respond. Check your API key, model access, and server logs.",
    });
  }
});

module.exports = router;
