
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const router = express.Router();

function validateProduct(body) {
  const { name, category, price, quantity } = body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof category !== "string" ||
    !category.trim() ||
    price === "" ||
    price === undefined ||
    quantity === "" ||
    quantity === undefined
  ) {
    return "Please complete all product fields.";
  }

  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    return "Price must be a valid non-negative number.";
  }

  if (
    !Number.isInteger(Number(quantity)) ||
    Number(quantity) < 0
  ) {
    return "Quantity must be a non-negative whole number.";
  }

  return null;
}

// GET ALL PRODUCTS
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
});

// ADD PRODUCT
router.post("/", async (req, res) => {
  try {
    const validationError = validateProduct(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const product = await Product.create({
      name: req.body.name.trim(),
      category: req.body.category.trim(),
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to add product.",
    });
  }
});

// UPDATE PRODUCT
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const validationError = validateProduct(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name.trim(),
        category: req.body.category.trim(),
        price: Number(req.body.price),
        quantity: Number(req.body.quantity),
      },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to update product.",
    });
  }
});

// DELETE PRODUCT
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Keep transaction history intact.
    const Sale = require("../models/Sale");
    const hasSales = await Sale.exists({ product: product._id });

    if (hasSales) {
      return res.status(409).json({
        success: false,
        message:
          "This product has sales history. Set its stock to zero instead of deleting it.",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to delete product.",
    });
  }
});

module.exports = router;
