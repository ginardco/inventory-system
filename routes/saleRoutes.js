
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Sale = require("../models/Sale");

const router = express.Router();

// GET SALES HISTORY
router.get("/", async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 }).limit(200);

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve sales history.",
    });
  }
});

// RECORD SALE AND DEDUCT STOCK
router.post("/", async (req, res) => {
  const { productId, quantity } = req.body;

  if (
    !mongoose.isValidObjectId(productId) ||
    !Number.isInteger(Number(quantity)) ||
    Number(quantity) < 1
  ) {
    return res.status(400).json({
      success: false,
      message: "Select a valid product and enter a whole quantity of at least 1.",
    });
  }

  const soldQuantity = Number(quantity);
  let updatedProduct;

  try {
    // Conditional update prevents selling more than available stock.
    updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        quantity: { $gte: soldQuantity },
      },
      {
        $inc: { quantity: -soldQuantity },
      },
      { new: true }
    );

    if (!updatedProduct) {
      const productExists = await Product.exists({ _id: productId });

      return res.status(productExists ? 409 : 404).json({
        success: false,
        message: productExists
          ? "Not enough stock available for this sale."
          : "Product not found.",
      });
    }

    const unitPrice = updatedProduct.price;

    const sale = await Sale.create({
      product: updatedProduct._id,
      productName: updatedProduct.name,
      quantity: soldQuantity,
      unitPrice,
      total: Number((unitPrice * soldQuantity).toFixed(2)),
    });

    res.status(201).json({
      success: true,
      message: "Sale recorded and stock updated successfully.",
      data: sale,
      remainingStock: updatedProduct.quantity,
    });
  } catch (error) {
    // Compensate if the sale record fails after stock was deducted.
    if (updatedProduct) {
      try {
        await Product.updateOne(
          { _id: updatedProduct._id },
          { $inc: { quantity: soldQuantity } }
        );
      } catch (restoreError) {
        console.error(
          "URGENT: Stock restoration failed:",
          restoreError.message
        );
      }
    }

    console.error("Sale error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to record the sale. Please check inventory before retrying.",
    });
  }
});

module.exports = router;
