const Budget = require("../models/Budget");
const {
  getCurrentMonth,
  getStatusDetails,
} = require("../utils/aiSummary");
const { predictFinalSpendLocal } = require("../utils/localBudgetPredictor");
const { buildPredictionsForMonth } = require("../utils/budgetPredictions");

const predictSpending = async (req, res) => {
  try {
    const {
      day_of_month,
      category,
      spent_so_far,
      transactions,
      avg_daily_spend,
      budget,
    } = req.body;

    const missingFields = [];

    if (day_of_month === undefined) missingFields.push("day_of_month");
    if (!category) missingFields.push("category");
    if (spent_so_far === undefined) missingFields.push("spent_so_far");
    if (transactions === undefined) missingFields.push("transactions");
    if (avg_daily_spend === undefined) missingFields.push("avg_daily_spend");
    if (budget === undefined) missingFields.push("budget");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required field(s): ${missingFields.join(", ")}`,
      });
    }

    const numericFields = {
      day_of_month: Number(day_of_month),
      spent_so_far: Number(spent_so_far),
      transactions: Number(transactions),
      avg_daily_spend: Number(avg_daily_spend),
      budget: Number(budget),
    };

    const invalidFields = Object.entries(numericFields)
      .filter(([, value]) => Number.isNaN(value))
      .map(([fieldName]) => fieldName);

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid numeric field(s): ${invalidFields.join(", ")}`,
      });
    }

    if (numericFields.budget <= 0) {
      return res.status(400).json({
        success: false,
        message: "budget must be greater than 0",
      });
    }

    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    // TODO: Replace with local trained ML model prediction service or Flask API.
    const predictedFinalSpend = await predictFinalSpendLocal({
      dayOfMonth: numericFields.day_of_month,
      daysInMonth: daysInMonth,
      category,
      spentSoFar: numericFields.spent_so_far,
      transactions: numericFields.transactions,
      avgDailySpend: numericFields.avg_daily_spend,
    });

    if (Number.isNaN(predictedFinalSpend)) {
      return res.status(502).json({
        success: false,
        message: "Invalid prediction result",
      });
    }

    const overrun = predictedFinalSpend - numericFields.budget;
    const overrunPercent =
      overrun > 0
        ? Math.round((overrun / numericFields.budget) * 100)
        : 0;

    const statusDetails = getStatusDetails(category, overrunPercent);

    return res.status(200).json({
      success: true,
      data: {
        category,
        budget: numericFields.budget,
        spentSoFar: numericFields.spent_so_far,
        predictedFinalSpend,
        overrunPercent,
        status: statusDetails.status,
        message: statusDetails.message,
      },
    });
  } catch (error) {
    console.error("AI prediction error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to compute spending prediction",
    });
  }
};

// @desc    Get AI summary for the most critical category in the current month
// @route   GET /api/ai/summary
// @access  Private
const getAiSummary = async (req, res) => {
  try {
    const month = req.query.month || getCurrentMonth();
    const budgetDoc = await Budget.findOne({
      user: req.user._id,
      month,
    }).lean();
    const total = Number(budgetDoc?.totalAmount);
    if (!budgetDoc || !Number.isFinite(total) || total <= 0) {
      return res.status(200).json({
        success: true,
        data: null,
        budgetRequired: true,
        message:
          "Set your monthly budget on the home screen to see AI spending insights.",
      });
    }

    const categorySummaries = await buildPredictionsForMonth(
      req.user._id,
      month
    );

    const mostCriticalCategory = categorySummaries[0];

    return res.status(200).json({
      success: true,
      data: {
        category: mostCriticalCategory.category,
        budget: mostCriticalCategory.budget,
        spentSoFar: mostCriticalCategory.spentSoFar,
        predictedFinalSpend: mostCriticalCategory.predictedFinalSpend,
        overrunPercent: mostCriticalCategory.overrunPercent,
        status: mostCriticalCategory.status,
        message: mostCriticalCategory.message,
      },
      budgetRequired: false,
    });
  } catch (error) {
    if (error.code === "NO_ALLOCATIONS") {
      return res.status(200).json({
        success: true,
        data: null,
        budgetRequired: true,
        message:
          "Allocate your budget across categories and save to unlock the AI summary.",
      });
    }

    console.error("Get AI summary error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI summary",
    });
  }
};

module.exports = {
  predictSpending,
  getAiSummary,
};
