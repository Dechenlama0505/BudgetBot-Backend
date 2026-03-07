const Category = require("../models/Category");

// @desc    Get all predefined categories
// @route   GET /api/categories
// @access  Public (or Private if you prefer)
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 }).lean();

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get categories",
    });
  }
};

module.exports = { getCategories };
