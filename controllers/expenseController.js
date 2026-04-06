const Expense = require("../models/Expense");
const Category = require("../models/Category");

// @desc    Add expense
// @route   POST /api/expenses
// @access  Private
const addExpense = async (req, res) => {
  try {
    const { amount, category, date } = req.body;

    if (amount == null || amount === "" || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid number",
      });
    }

    const numAmount = Number(amount);
    if (numAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount cannot be negative",
      });
    }

    if (!category || typeof category !== "string" || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const validCat = await Category.findOne({ name: category.trim() });
    if (!validCat) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Use only predefined categories.",
      });
    }

    const expense = await Expense.create({
      user: req.user._id,
      amount: numAmount,
      category: validCat.name,
      date: date ? new Date(date) : new Date(),
    });

    const populated = await Expense.findById(expense._id).lean();

    res.status(201).json({
      success: true,
      data: {
        _id: populated._id,
        amount: populated.amount,
        category: populated.category,
        date: populated.date,
        createdAt: populated.createdAt,
      },
    });
  } catch (error) {
    console.error("Add expense error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to add expense",
    });
  }
};

// @desc    Get expenses for current user (optionally filter by month)
// @route   GET /api/expenses
// @access  Private
// Query: month=YYYY-MM (optional, default current month for summary); all=true returns all expenses
const getExpenses = async (req, res) => {
  try {
    const { month, all } = req.query;
    const userId = req.user._id;

    const filter = { user: userId };

    if (all !== "true" && month) {
      const [year, monthNum] = month.split("-").map(Number);
      if (!isNaN(year) && !isNaN(monthNum)) {
        const start = new Date(year, monthNum - 1, 1);
        const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
        filter.date = { $gte: start, $lte: end };
      }
    }

    if (all !== "true" && !month) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      filter.date = { $gte: start, $lte: end };
    }

    const expenses = await Expense.find(filter)
      .sort({ date: -1 })
      .lean()
      .select("_id amount category date createdAt");

    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const categoryTotals = {};
    expenses.forEach((e) => {
      const cat = e.category || "Others";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    });

    res.status(200).json({
      success: true,
      data: {
        expenses,
        total,
        categoryTotals,
      },
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get expenses",
    });
  }
};

// @desc    Get summary only (total, categoryTotals) for current month - for home page
// @route   GET /api/expenses/summary
// @access  Private
// Query: month=YYYY-MM (optional)
const getSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const userId = req.user._id;

    const filter = { user: userId };

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      if (!isNaN(year) && !isNaN(monthNum)) {
        const start = new Date(year, monthNum - 1, 1);
        const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
        filter.date = { $gte: start, $lte: end };
      }
    } else {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      filter.date = { $gte: start, $lte: end };
    }

    const expenses = await Expense.find(filter).lean().select("amount category");

    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const categoryTotals = {};
    expenses.forEach((e) => {
      const cat = e.category || "Others";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        categoryTotals,
      },
    });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get summary",
    });
  }
};

// @desc    Get expense history for current user
// @route   GET /api/expenses/history
// @access  Private
// Query: limit=number (optional)
const getExpenseHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const parsedLimit = Number.parseInt(req.query.limit, 10);

    const query = Expense.find({ user: userId })
      .sort({ date: -1, createdAt: -1, _id: -1 })
      .select("_id category amount date")
      .lean();

    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      query.limit(parsedLimit);
    }

    const expenses = await query;

    res.status(200).json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error("Get expense history error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get expense history",
    });
  }
};

module.exports = {
  addExpense,
  getExpenses,
  getSummary,
  getExpenseHistory,
};
