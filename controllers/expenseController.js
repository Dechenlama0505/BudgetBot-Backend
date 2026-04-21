const Expense = require("../models/Expense");
const Category = require("../models/Category");
const Budget = require("../models/Budget");
const mongoose = require("mongoose");
const {
  buildPredictionsForMonth,
  pickBestPredictionForCategory,
} = require("../utils/budgetPredictions");
const {
  buildHomeAlertItems,
  buildHomeAlertSummary,
} = require("../utils/aiSummary");

const getMonthFromDate = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthDateRange = (month) => {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);

  return { start, end };
};

const normalizeAllocations = (allocations) => {
  if (!allocations) {
    return {};
  }

  if (allocations instanceof Map) {
    return Object.fromEntries(allocations.entries());
  }

  return { ...allocations };
};

const buildMonthlyExpenseSnapshot = async (userId, month) => {
  const { start, end } = getMonthDateRange(month);
  const expenses = await Expense.find({
    user: userId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: -1, createdAt: -1, _id: -1 })
    .lean()
    .select("_id amount category date createdAt");

  const total = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const categoryTotals = {};

  expenses.forEach((expense) => {
    const category = expense.category || "Others";
    categoryTotals[category] = (categoryTotals[category] || 0) + (expense.amount || 0);
  });

  return {
    expenses,
    total,
    categoryTotals,
  };
};

const buildMonthlyInsightsSnapshot = async (userId, month) => {
  const { start, end } = getMonthDateRange(month);
  const [expenses, budgetDoc] = await Promise.all([
    Expense.find({
      user: userId,
      date: { $gte: start, $lte: end },
    })
      .lean()
      .select("amount category"),
    Budget.findOne({ user: userId, month }).lean(),
  ]);

  const categorySpent = {};
  let totalSpent = 0;

  expenses.forEach((expense) => {
    const category = expense.category || "Others";
    categorySpent[category] = (categorySpent[category] || 0) + (expense.amount || 0);
    totalSpent += expense.amount || 0;
  });

  const totalBudget = Number(budgetDoc?.totalAmount) || 0;
  const allocations = normalizeAllocations(budgetDoc?.allocations);
  const categoryBreakdown = [];
  const categories = new Set([
    ...Object.keys(categorySpent),
    ...Object.keys(allocations),
  ]);

  categories.forEach((category) => {
    const spent = categorySpent[category] || 0;
    const budgetPercentage = Number(allocations[category]) || 0;
    const budgetAmount = totalBudget > 0 ? (totalBudget * budgetPercentage) / 100 : 0;

    categoryBreakdown.push({
      category,
      spent,
      budgetAmount,
      budgetPercentage,
      crossed: budgetAmount > 0 && spent > budgetAmount,
    });
  });

  categoryBreakdown.sort((a, b) => b.spent - a.spent);

  return {
    month,
    totalBudget,
    totalSpent,
    budgetUsedPercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    categoryBreakdown,
  };
};

const buildAiRefreshSnapshot = async (userId, month) => {
  try {
    const predictions = await buildPredictionsForMonth(userId, month);
    const homeAlerts = buildHomeAlertItems(predictions, { limit: 3 });
    const homeAlert = homeAlerts[0] || buildHomeAlertSummary(predictions);
    const aiSummary = homeAlert || predictions[0] || null;

    return {
      data: predictions,
      homeAlerts,
      homeAlert,
      aiSummary: aiSummary
        ? {
            category: aiSummary.category,
            budget: aiSummary.budget,
            spentSoFar: aiSummary.spentSoFar,
            predictedFinalSpend: aiSummary.predictedFinalSpend,
            overrunPercent: aiSummary.overrunPercent,
            status: aiSummary.status,
            message: aiSummary.message,
          }
        : null,
      budgetRequired: false,
      message: null,
    };
  } catch (error) {
    if (error.code === "NO_BUDGET") {
      return {
        data: [],
        homeAlerts: [],
        homeAlert: null,
        aiSummary: null,
        budgetRequired: true,
        message:
          "Set your monthly budget on the home screen to unlock AI spending forecasts and alerts.",
      };
    }

    if (error.code === "NO_ALLOCATIONS") {
      return {
        data: [],
        homeAlerts: [],
        homeAlert: null,
        aiSummary: null,
        budgetRequired: true,
        message:
          "Split your budget across categories with the sliders, then save — you’ll see AI forecasts here.",
      };
    }

    throw error;
  }
};

const validateExpensePayload = async ({ amount, category }) => {
  if (amount == null || amount === "" || isNaN(Number(amount))) {
    return {
      status: 400,
      message: "Amount must be a valid number",
    };
  }

  const numAmount = Number(amount);
  if (numAmount < 0) {
    return {
      status: 400,
      message: "Amount cannot be negative",
    };
  }

  if (!category || typeof category !== "string" || !category.trim()) {
    return {
      status: 400,
      message: "Category is required",
    };
  }

  const validCategory = await Category.findOne({ name: category.trim() }).lean();
  if (!validCategory) {
    return {
      status: 400,
      message: "Invalid category. Use only predefined categories.",
    };
  }

  return {
    status: 200,
    data: {
      amount: numAmount,
      category: validCategory.name,
    },
  };
};

const parseExpenseDate = (value) => {
  if (!value) {
    return { valid: true, date: new Date() };
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      valid: false,
      message: "Date must be valid",
    };
  }

  return {
    valid: true,
    date: parsedDate,
  };
};

// @desc    Add expense
// @route   POST /api/expenses
// @access  Private
const addExpense = async (req, res) => {
  try {
    const { amount, category, date } = req.body;

    const validation = await validateExpensePayload({ amount, category });
    if (validation.status !== 200) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const parsedDate = parseExpenseDate(date);
    if (!parsedDate.valid) {
      return res.status(400).json({
        success: false,
        message: parsedDate.message,
      });
    }

    const expense = await Expense.create({
      user: req.user._id,
      amount: validation.data.amount,
      category: validation.data.category,
      date: parsedDate.date,
    });

    const populated = await Expense.findById(expense._id).lean();
    const expenseData = {
      _id: populated._id,
      amount: populated.amount,
      category: populated.category,
      date: populated.date,
      createdAt: populated.createdAt,
    };

    const predictionMonth = getMonthFromDate(populated.date);
    let prediction = null;
    let predictionMessage = null;
    let predictionError = null;

    try {
      const predictions = await buildPredictionsForMonth(
        req.user._id,
        predictionMonth
      );

      prediction = pickBestPredictionForCategory(
        predictions,
        populated.category
      );
      predictionMessage = prediction?.message || null;
    } catch (predictionIssue) {
      if (
        predictionIssue.code === "NO_BUDGET" ||
        predictionIssue.code === "NO_ALLOCATIONS"
      ) {
        predictionMessage = predictionIssue.message;
      } else {
        console.error("Refresh prediction after expense error:", predictionIssue);
        predictionError = "Unable to generate prediction at this time";
      }
    }

    res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: expenseData,
      expense: expenseData,
      prediction,
      predictionMessage,
      predictionError,
    });
  } catch (error) {
    console.error("Add expense error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to add expense",
    });
  }
};

// @desc    Update an expense for the current user and return refreshed dashboard data
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense id",
      });
    }

    const validation = await validateExpensePayload({ amount, category });
    if (validation.status !== 200) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const parsedDate = parseExpenseDate(date);
    if (!parsedDate.valid) {
      return res.status(400).json({
        success: false,
        message: parsedDate.message,
      });
    }

    const existingExpense = await Expense.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!existingExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const previousMonth = getMonthFromDate(existingExpense.date);

    existingExpense.amount = validation.data.amount;
    existingExpense.category = validation.data.category;
    existingExpense.date = parsedDate.date;

    await existingExpense.save();

    const updatedExpense = await Expense.findById(existingExpense._id)
      .lean()
      .select("_id amount category date createdAt updatedAt");

    const updatedMonth = getMonthFromDate(updatedExpense.date);
    const impactedMonths = [...new Set([previousMonth, updatedMonth])];

    const refreshedMonths = await Promise.all(
      impactedMonths.map(async (month) => {
        const [summary, insights, ai] = await Promise.all([
          buildMonthlyExpenseSnapshot(req.user._id, month),
          buildMonthlyInsightsSnapshot(req.user._id, month),
          buildAiRefreshSnapshot(req.user._id, month),
        ]);

        return {
          month,
          summary,
          insights,
          ai,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: {
        expense: updatedExpense,
        previousMonth,
        updatedMonth,
        refreshedMonths,
      },
    });
  } catch (error) {
    console.error("Update expense error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update expense",
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

// @desc    Delete an expense for the current user and return refreshed dashboard data
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense id",
      });
    }

    const deletedExpense = await Expense.findOneAndDelete({
      _id: id,
      user: req.user._id,
    })
      .lean()
      .select("_id amount category date createdAt");

    if (!deletedExpense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    const month = getMonthFromDate(deletedExpense.date);
    const [summary, insights, ai] = await Promise.all([
      buildMonthlyExpenseSnapshot(req.user._id, month),
      buildMonthlyInsightsSnapshot(req.user._id, month),
      buildAiRefreshSnapshot(req.user._id, month),
    ]);

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
      data: {
        deletedExpense,
        month,
        summary,
        insights,
        ai,
      },
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete expense",
    });
  }
};

module.exports = {
  addExpense,
  updateExpense,
  getExpenses,
  getSummary,
  getExpenseHistory,
  deleteExpense,
};
