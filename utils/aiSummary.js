const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const getMonthDateRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);

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

const formatCurrencyNpr = (value) => {
  const amount = Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
  return `Rs. ${amount.toLocaleString("en-IN")}`;
};

const calculateOverrunPercent = ({ spentSoFar, predictedFinalSpend, budget }) => {
  if (!Number.isFinite(budget) || budget <= 0) return 0;

  // Keep overrun aligned with forecast spend while preventing impossible under-spend scenarios.
  const forecastSpend = Math.max(
    Number(predictedFinalSpend) || 0,
    Number(spentSoFar) || 0
  );

  if (forecastSpend > budget) {
    return Math.round(((forecastSpend - budget) / budget) * 100);
  }

  return 0;
};

const getStatusDetails = (
  category,
  overrunPercent,
  spentSoFar,
  predictedFinalSpend,
  budget
) => {
  const currentOverrunPercent =
    Number.isFinite(budget) && budget > 0 && Number(spentSoFar) > Number(budget)
      ? Math.round(((Number(spentSoFar) - Number(budget)) / Number(budget)) * 100)
      : 0;

  const effectiveOverrunPercent =
    Number.isFinite(overrunPercent) && overrunPercent > 0
      ? overrunPercent
      : calculateOverrunPercent({ spentSoFar, predictedFinalSpend, budget });

  if (spentSoFar > budget) {
    const status = effectiveOverrunPercent > 20 ? "High Risk" : "Over Budget";
    const projectedIncrease = Number(predictedFinalSpend) - Number(spentSoFar);
    const projectedIncreasePercent =
      Number(spentSoFar) > 0
        ? (projectedIncrease / Number(spentSoFar)) * 100
        : 0;

    let message = `You have already exceeded your ${category} budget by ${currentOverrunPercent}%.`;
    if (projectedIncreasePercent >= 3) {
      message += ` At this pace, you may end the month ${effectiveOverrunPercent}% over budget, reaching around ${formatCurrencyNpr(
        predictedFinalSpend
      )}.`;
    } else {
      message += ` It is likely to remain around ${effectiveOverrunPercent}% over budget by month end.`;
    }

    return { status, message };
  }

  if (spentSoFar <= budget && predictedFinalSpend > budget) {
    return {
      status: effectiveOverrunPercent > 20 ? "High Risk" : "Medium Risk",
      message: `Based on your current spending pace, ${category} is likely to exceed its budget by ${effectiveOverrunPercent}% before month end.`,
    };
  }

  return {
    status: "Safe",
    message: "Your current spending pace suggests this category is staying within budget.",
  };
};

const sortByRisk = (a, b) => {
  if (b.overrunPercent !== a.overrunPercent) {
    return b.overrunPercent - a.overrunPercent;
  }

  const bOverrunAmount =
    Math.max(Number(b.predictedFinalSpend || 0), Number(b.spentSoFar || 0)) -
    Number(b.budget || 0);
  const aOverrunAmount =
    Math.max(Number(a.predictedFinalSpend || 0), Number(a.spentSoFar || 0)) -
    Number(a.budget || 0);
  if (bOverrunAmount !== aOverrunAmount) {
    return bOverrunAmount - aOverrunAmount;
  }

  return Number(b.spentSoFar || 0) - Number(a.spentSoFar || 0);
};

const buildHomeAlertItems = (predictions, options = {}) => {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 3;
  const nearThresholdRatio = Number(options.nearThresholdRatio) || 0.92;

  if (!Array.isArray(predictions) || predictions.length === 0) {
    return [];
  }

  const exceededCategories = predictions
    .filter((item) => Number(item.spentSoFar) > Number(item.budget))
    .sort(sortByRisk)
    .map((item) => {
      const details = getStatusDetails(
        item.category,
        item.overrunPercent,
        item.spentSoFar,
        item.predictedFinalSpend,
        item.budget
      );
      const prefix = details.status === "High Risk" ? "High Risk: " : "";
      return {
        ...item,
        status: details.status,
        message: `${prefix}${details.message}`,
        priorityGroup: "P1_OVER_BUDGET",
      };
    });

  const predictedToExceed = predictions
    .filter(
      (item) =>
        Number(item.spentSoFar) <= Number(item.budget) &&
        Number(item.predictedFinalSpend) > Number(item.budget)
    )
    .sort(sortByRisk)
    .map((item) => {
      const details = getStatusDetails(
        item.category,
        item.overrunPercent,
        item.spentSoFar,
        item.predictedFinalSpend,
        item.budget
      );
      return {
        ...item,
        status: details.status,
        message: details.message,
        priorityGroup: "P2_PREDICTED_OVER",
      };
    });

  const nearLimitCategories = predictions
    .filter((item) => {
      const budget = Number(item.budget) || 0;
      const predicted = Number(item.predictedFinalSpend) || 0;
      const spent = Number(item.spentSoFar) || 0;

      if (budget <= 0) return false;
      if (spent > budget) return false;
      if (predicted > budget) return false;

      const ratio = predicted / budget;
      return ratio >= nearThresholdRatio;
    })
    .sort((a, b) => {
      const bRatio = Number(b.predictedFinalSpend || 0) / Math.max(Number(b.budget || 0), 1);
      const aRatio = Number(a.predictedFinalSpend || 0) / Math.max(Number(a.budget || 0), 1);
      if (bRatio !== aRatio) return bRatio - aRatio;
      return Number(b.spendingProgress || 0) - Number(a.spendingProgress || 0);
    })
    .map((item) => ({
      ...item,
      status: item.status || "Watch",
      message: `${item.category} is approaching its budget limit based on your current spending pace.`,
      priorityGroup: "P3_NEAR_LIMIT",
    }));

  const ranked = [];
  const seen = new Set();

  [exceededCategories, predictedToExceed, nearLimitCategories].forEach((group) => {
    group.forEach((item) => {
      if (ranked.length >= limit) return;
      if (seen.has(item.category)) return;
      seen.add(item.category);
      ranked.push(item);
    });
  });

  if (ranked.length > 0) {
    return ranked;
  }

  return [
    {
      category: "Overall",
      budget: 0,
      spentSoFar: 0,
      predictedFinalSpend: 0,
      overrunPercent: 0,
      status: "Safe",
      message:
        "No budget overrun is predicted right now. Your current spending pace is within budget.",
      priorityGroup: "SAFE_SUMMARY",
    },
  ];
};

const buildHomeAlertSummary = (predictions) => {
  const items = buildHomeAlertItems(predictions, { limit: 1 });
  return items[0] || null;
};

const buildCategoryInputList = ({ budgetDoc, expenses, dayOfMonth }) => {
  const allocations = normalizeAllocations(budgetDoc.allocations);
  const categoryNames = Object.keys(allocations);

  return categoryNames
    .map((categoryName) => {
      const allocationPercent = Number(allocations[categoryName]) || 0;
      const budgetAmount = Number(
        ((budgetDoc.totalAmount || 0) * allocationPercent) / 100
      );

      if (budgetAmount <= 0) {
        return null;
      }

      const categoryExpenses = expenses.filter(
        (expense) => expense.category === categoryName
      );

      const spentSoFar = categoryExpenses.reduce(
        (sum, expense) => sum + (expense.amount || 0),
        0
      );

      const transactions = categoryExpenses.length;
      const avgDailySpend =
        dayOfMonth > 0 ? Number((spentSoFar / dayOfMonth).toFixed(2)) : 0;
      const spendingProgress =
        budgetAmount > 0 ? (spentSoFar / budgetAmount) * 100 : 0;

      return {
        category: categoryName,
        budget: Number(budgetAmount.toFixed(2)),
        spentSoFar: Number(spentSoFar.toFixed(2)),
        transactions,
        avgDailySpend,
        spendingProgress,
      };
    })
    .filter(Boolean);
};

module.exports = {
  getCurrentMonth,
  getMonthDateRange,
  calculateOverrunPercent,
  getStatusDetails,
  buildHomeAlertItems,
  buildHomeAlertSummary,
  buildCategoryInputList,
};
