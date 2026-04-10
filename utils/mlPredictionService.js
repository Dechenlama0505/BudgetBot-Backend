const axios = require("axios");

async function predictFinalSpendML({
  dayOfMonth,
  category,
  spentSoFar,
  transactions,
  avgDailySpend,
}) {
  const response = await axios.post("http://127.0.0.1:5002/predict", {
    day_of_month: dayOfMonth,
    category,
    spent_so_far: spentSoFar,
    transactions,
    avg_daily_spend: avgDailySpend,
  });

  return response.data.predictedFinalSpend;
}

module.exports = {
  predictFinalSpendML,
};
