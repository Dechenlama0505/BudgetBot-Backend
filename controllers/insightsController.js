const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const User = require("../models/User");

const getCurrentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

// @desc    Get insights: spending vs budget by category, crossed budgets
// @route   GET /api/insights
// @access  Private
// Query: month=YYYY-MM (optional)
const getInsights = async (req, res) => {
  try {
    const month = req.query.month || getCurrentMonth();
    const userId = req.user._id;

    const [year, monthNum] = month.split("-").map(Number);
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0, 23, 59, 59, 999);

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
    expenses.forEach((e) => {
      const cat = e.category || "Others";
      categorySpent[cat] = (categorySpent[cat] || 0) + (e.amount || 0);
      totalSpent += e.amount || 0;
    });

    const totalBudget = budgetDoc ? budgetDoc.totalAmount : 0;
    let allocations = {};
    if (budgetDoc && budgetDoc.allocations) {
      if (budgetDoc.allocations instanceof Map) {
        budgetDoc.allocations.forEach((v, k) => {
          allocations[k] = v;
        });
      } else {
        allocations = { ...budgetDoc.allocations };
      }
    }

    const categoryBreakdown = [];
    const cats = new Set([
      ...Object.keys(categorySpent),
      ...Object.keys(allocations),
    ]);

    cats.forEach((category) => {
      const spent = categorySpent[category] || 0;
      const pct = allocations[category] || 0;
      const budgetAmount = totalBudget > 0 ? (totalBudget * pct) / 100 : 0;
      const crossed = budgetAmount > 0 && spent > budgetAmount;

      categoryBreakdown.push({
        category,
        spent,
        budgetAmount,
        budgetPercentage: pct,
        crossed,
      });
    });

    categoryBreakdown.sort((a, b) => b.spent - a.spent);

    res.status(200).json({
      success: true,
      data: {
        month,
        totalBudget,
        totalSpent,
        budgetUsedPercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error("Get insights error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get insights",
    });
  }
};

// @desc    Get income vs spending for current month and previous 3 months (4 months total)
// @route   GET /api/insights/income-vs-spending
// @access  Private
const getIncomeVsSpending = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    const income = user?.monthlyIncome ?? 0;

    const now = new Date();
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      months.push(`${y}-${m}`);
    }

    const results = await Promise.all(
      months.map(async (month) => {
        const [year, monthNum] = month.split("-").map(Number);
        const start = new Date(year, monthNum - 1, 1);
        const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
        const expenses = await Expense.find({
          user: userId,
          date: { $gte: start, $lte: end },
        })
          .lean()
          .select("amount");
        const spending = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = `${monthNames[monthNum - 1]} ${year}`;
        return {
          month,
          label,
          income,
          spending,
          net: income - spending,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: { months: results },
    });
  } catch (error) {
    console.error("Get income vs spending error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get income vs spending",
    });
  }
};

module.exports = { getInsights, getIncomeVsSpending };
