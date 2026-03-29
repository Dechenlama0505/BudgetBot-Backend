const axios = require("axios");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const {
    getCurrentMonth,
    getMonthDateRange,
    getStatusDetails,
    buildCategoryInputList,
} = require("../utils/aiSummary");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5002";

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

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, {
            day_of_month: numericFields.day_of_month,
            category,
            spent_so_far: numericFields.spent_so_far,
            transactions: numericFields.transactions,
            avg_daily_spend: numericFields.avg_daily_spend,
        });

        const predictedFinalSpend = Number(aiResponse.data.predicted_final_spend);

        if (Number.isNaN(predictedFinalSpend)) {
            return res.status(502).json({
                success: false,
                message: "Invalid response received from AI service",
            });
        }

        const overrun = predictedFinalSpend - numericFields.budget;
        const overrunPercent =
            overrun > 0
                ? Math.round((overrun / numericFields.budget) * 100)
                : 0;

        let status = "Safe";
        let message = "Your spending is currently within budget.";

        if (overrunPercent > 0 && overrunPercent <= 10) {
            status = "Medium Risk";
            message = `Based on your current spending pattern, you may exceed your ${category} budget by ${overrunPercent}% this month.`;
        }

        if (overrunPercent > 10) {
            status = "High Risk";
            message = `Based on your current spending pattern, you may exceed your ${category} budget by ${overrunPercent}% this month.`;
        }

        return res.status(200).json({
            success: true,
            data: {
                category: aiResponse.data.category || category,
                budget: numericFields.budget,
                spentSoFar: numericFields.spent_so_far,
                predictedFinalSpend,
                overrunPercent,
                status,
                message,
            },
        });
    } catch (error) {
        console.error("AI prediction error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to get prediction from AI service",
        });
    }
};

// @desc    Get AI summary for the most critical category in the current month
// @route   GET /api/ai/summary
// @access  Private
const getAiSummary = async (req, res) => {
    try {
        const month = req.query.month || getCurrentMonth();
        const dayOfMonth = new Date().getDate();
        const { start, end } = getMonthDateRange(month);

        const [budgetDoc, expenses] = await Promise.all([
            Budget.findOne({
                user: req.user._id,
                month,
            }).lean(),
            Expense.find({
                user: req.user._id,
                date: { $gte: start, $lte: end },
            })
                .lean()
                .select("amount category"),
        ]);

        if (!budgetDoc) {
            return res.status(404).json({
                success: false,
                message: `No budget found for ${month}. Please save your monthly budget first.`,
            });
        }

        const categoryInputs = buildCategoryInputList({
            budgetDoc,
            expenses,
            dayOfMonth,
        });

        if (categoryInputs.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid budget allocations found for this month.",
            });
        }

        // We predict each budget category, then choose the most critical one.
        const categorySummaries = await Promise.all(
            categoryInputs.map(async (item) => {
                let predictedFinalSpend = 0;

                if (item.spentSoFar > 0 || item.transactions > 0) {
                    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, {
                        day_of_month: dayOfMonth,
                        category: item.category,
                        spent_so_far: item.spentSoFar,
                        transactions: item.transactions,
                        avg_daily_spend: item.avgDailySpend,
                    });

                    predictedFinalSpend = Number(aiResponse.data.predicted_final_spend);
                }

                if (Number.isNaN(predictedFinalSpend)) {
                    throw new Error(`Invalid AI response for category: ${item.category}`);
                }

                const roundedPrediction = Number(predictedFinalSpend.toFixed(2));
                const overrun = roundedPrediction - item.budget;
                const overrunPercent =
                    overrun > 0 ? Math.round((overrun / item.budget) * 100) : 0;
                const statusDetails = getStatusDetails(item.category, overrunPercent);

                return {
                    category: item.category,
                    budget: item.budget,
                    spentSoFar: item.spentSoFar,
                    predictedFinalSpend: roundedPrediction,
                    overrunPercent,
                    spendingProgress: item.spendingProgress,
                    status: statusDetails.status,
                    message: statusDetails.message,
                };
            }),
        );

        categorySummaries.sort((a, b) => {
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
        });
    } catch (error) {
        console.error("Get AI summary error:", error.message);

        const statusCode = error.response?.status === 404 ? 502 : 500;
        const message =
            error.response?.data?.message ||
            "Failed to generate AI summary";

        return res.status(statusCode).json({
            success: false,
            message,
        });
    }
};

module.exports = {
    predictSpending,
    getAiSummary,
};
