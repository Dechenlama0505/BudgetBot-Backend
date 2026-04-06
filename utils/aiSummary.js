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

const getStatusDetails = (category, overrunPercent) => {
  if (overrunPercent === 0) {
    return {
      status: "Safe",
      message: `You are currently within your ${category} budget.`,
    };
  }

  if (overrunPercent <= 10) {
    return {
      status: "Medium Risk",
      message: `Based on your current spending pattern, you may exceed your ${category} budget by ${overrunPercent}% this month.`,
    };
  }

  return {
    status: "High Risk",
    message: `High Risk: You may exceed your ${category} budget by ${overrunPercent}% before month end.`,
  };
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
  getStatusDetails,
  buildCategoryInputList,
};
