const Budget = require("../models/Budget");
const User = require("../models/User");

const getCurrentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

// @desc    Get budget for month
// @route   GET /api/budgets
// @access  Private
// Query: month=YYYY-MM (optional, default current month)
const getBudget = async (req, res) => {
  try {
    const month = req.query.month || getCurrentMonth();
    const budget = await Budget.findOne({
      user: req.user._id,
      month,
    }).lean();

    if (!budget) {
      return res.status(200).json({
        success: true,
        data: {
          budget: null,
          month,
        },
      });
    }

    const allocationsObj = {};
    if (budget.allocations && budget.allocations instanceof Map) {
      budget.allocations.forEach((v, k) => {
        allocationsObj[k] = v;
      });
    } else if (typeof budget.allocations === "object" && budget.allocations !== null) {
      Object.assign(allocationsObj, budget.allocations);
    }

    res.status(200).json({
      success: true,
      data: {
        budget: {
          _id: budget._id,
          month: budget.month,
          totalAmount: budget.totalAmount,
          allocations: allocationsObj,
        },
        month,
      },
    });
  } catch (error) {
    console.error("Get budget error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get budget",
    });
  }
};

// @desc    Create or update budget for month
// @route   PUT /api/budgets
// @access  Private
const upsertBudget = async (req, res) => {
  try {
    const { month, totalAmount, allocations } = req.body;
    const monthKey = month || getCurrentMonth();

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const income = user.monthlyIncome ?? 0;
    const numAmount = Number(totalAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Total budget must be a valid non-negative number",
      });
    }
    if (numAmount > income) {
      return res.status(400).json({
        success: false,
        message: "Budget cannot exceed your monthly income",
      });
    }

    const allocMap = new Map();
    if (allocations && typeof allocations === "object") {
      const budgetCats = user.budgetCategories || [];
      let sum = 0;
      for (const [cat, pct] of Object.entries(allocations)) {
        const val = Number(pct);
        if (isNaN(val) || val < 0 || val > 100) continue;
        if (!budgetCats.includes(cat)) continue;
        allocMap.set(cat, val);
        sum += val;
      }
      if (sum > 100) {
        return res.status(400).json({
          success: false,
          message: "Total allocation cannot exceed 100%",
        });
      }
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month: monthKey },
      {
        $set: {
          totalAmount: numAmount,
          allocations: Object.fromEntries(allocMap),
        },
      },
      { new: true, upsert: true }
    );

    const allocationsObj = {};
    if (budget.allocations && budget.allocations instanceof Map) {
      budget.allocations.forEach((v, k) => {
        allocationsObj[k] = v;
      });
    } else if (typeof budget.allocations === "object" && budget.allocations !== null) {
      Object.assign(allocationsObj, budget.allocations);
    }

    res.status(200).json({
      success: true,
      message: "Budget saved successfully",
      data: {
        budget: {
          _id: budget._id,
          month: budget.month,
          totalAmount: budget.totalAmount,
          allocations: allocationsObj,
        },
      },
    });
  } catch (error) {
    console.error("Upsert budget error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save budget",
    });
  }
};

module.exports = { getBudget, upsertBudget };
