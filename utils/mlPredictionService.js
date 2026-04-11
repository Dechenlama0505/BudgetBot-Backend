const axios = require("axios");

async function predictFinalSpendML({
  dayOfMonth,
  category,
  spentSoFar,
  transactions,
  avgDailySpend,
}) {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) {
    throw new Error("AI_SERVICE_URL is not configured");
  }

  const response = await axios.post(
    `${baseUrl.replace(/\/$/, "")}/predict`,
    {
      day_of_month: dayOfMonth,
      category,
      spent_so_far: spentSoFar,
      transactions,
      avg_daily_spend: avgDailySpend,
    },
    {
      timeout: 10000,
    }
  );

  const predictedFinalSpend = Number(response?.data?.predictedFinalSpend);
  if (!Number.isFinite(predictedFinalSpend)) {
    throw new Error("ML service returned invalid predictedFinalSpend");
  }

  return predictedFinalSpend;
}

module.exports = {
  predictFinalSpendML,
};
