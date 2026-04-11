const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const {
  getCurrentMonth,
  getMonthDateRange,
  calculateOverrunPercent,
  getStatusDetails,
  buildCategoryInputList,
} = require("./aiSummary");
const { predictFinalSpendML } = require("./mlPredictionService");
const { predictFinalSpendLocal } = require("./localBudgetPredictor");

function daysInMonthFromYyyyMm(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function dayOfMonthForContext(month, currentMonthStr) {
  if (month === currentMonthStr) return new Date().getDate();
  if (month < currentMonthStr) return daysInMonthFromYyyyMm(month);
  return 1;
}

async function computeCategoryPrediction(item, month, currentMonthStr) {
  const dim = daysInMonthFromYyyyMm(month);
  const dom = dayOfMonthForContext(month, currentMonthStr);

  let predictedFinalSpend;

  if (month < currentMonthStr) {
    predictedFinalSpend = item.spentSoFar;
  } else if (item.spentSoFar <= 0 && item.transactions === 0) {
    predictedFinalSpend = 0;
  } else {
    try {
      predictedFinalSpend = await predictFinalSpendML({
        dayOfMonth: dom,
        category: item.category,
        spentSoFar: item.spentSoFar,
        transactions: item.transactions,
        avgDailySpend: item.avgDailySpend,
      });
      console.log("Prediction path: ML service", {
        category: item.category,
        dayOfMonth: dom,
        predictedFinalSpend,
      });
    } catch (error) {
      console.error(
        "ML service failed in budgetPredictions after retries, using local fallback:",
        error.message
      );

      predictedFinalSpend = await predictFinalSpendLocal({
        dayOfMonth: dom,
        daysInMonth: dim,
        category: item.category,
        spentSoFar: item.spentSoFar,
        transactions: item.transactions,
        avgDailySpend: item.avgDailySpend,
      });
      console.log("Prediction path: local fallback", {
        category: item.category,
        dayOfMonth: dom,
        predictedFinalSpend,
      });
    }
  }

  const roundedPrediction = Number(Number(predictedFinalSpend).toFixed(2));
  const overrunPercent = calculateOverrunPercent({
    spentSoFar: item.spentSoFar,
    predictedFinalSpend: roundedPrediction,
    budget: item.budget,
  });
  console.log("Prediction normalized", {
    category: item.category,
    budget: item.budget,
    spentSoFar: item.spentSoFar,
    predictedFinalSpend: roundedPrediction,
    overrunPercent,
  });
  const statusDetails = getStatusDetails(
    item.category,
    overrunPercent,
    item.spentSoFar,
    roundedPrediction,
    item.budget
  );

  return {
    category: item.category,
    budget: item.budget,
    spentSoFar: item.spentSoFar,
    transactions: item.transactions,
    avgDailySpend: item.avgDailySpend,
    dayOfMonth: dom,
    daysInMonth: dim,
    predictedFinalSpend: roundedPrediction,
    overrunPercent,
    spendingProgress: item.spendingProgress,
    status: statusDetails.status,
    message: statusDetails.message,
  };
}

/**
 * Build AI-style predictions for every budget category for a month.
 * @param {import("mongoose").Types.ObjectId} userId
 * @param {string} month YYYY-MM
 */
async function buildPredictionsForMonth(userId, month) {
  const { start, end } = getMonthDateRange(month);
  const currentMonthStr = getCurrentMonth();

  const [budgetDoc, expenses] = await Promise.all([
    Budget.findOne({ user: userId, month }).lean(),
    Expense.find({
      user: userId,
      date: { $gte: start, $lte: end },
    })
      .lean()
      .select("amount category"),
  ]);

  if (!budgetDoc) {
    const err = new Error(
      `No budget found for ${month}. Please save your monthly budget first.`
    );
    err.code = "NO_BUDGET";
    throw err;
  }

  const dayOfMonthForList = dayOfMonthForContext(month, currentMonthStr);

  const categoryInputs = buildCategoryInputList({
    budgetDoc,
    expenses,
    dayOfMonth: dayOfMonthForList,
  });

  if (categoryInputs.length === 0) {
    const err = new Error("No valid budget allocations found for this month.");
    err.code = "NO_ALLOCATIONS";
    throw err;
  }

  const summaries = await Promise.all(
    categoryInputs.map((item) =>
      computeCategoryPrediction(item, month, currentMonthStr)
    )
  );

  summaries.sort((a, b) => {
    if (b.overrunPercent !== a.overrunPercent) {
      return b.overrunPercent - a.overrunPercent;
    }
    if (b.spendingProgress !== a.spendingProgress) {
      return b.spendingProgress - a.spendingProgress;
    }
    if (b.spentSoFar !== a.spentSoFar) {
      return b.spentSoFar - a.spentSoFar;
    }
    return a.category.localeCompare(b.category);
  });

  return summaries;
}

function pickBestPredictionForCategory(predictions, category) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return null;
  }

  return (
    predictions.find((item) => item.category === category) ||
    predictions[0]
  );
}

module.exports = {
  buildPredictionsForMonth,
  daysInMonthFromYyyyMm,
  pickBestPredictionForCategory,
};
