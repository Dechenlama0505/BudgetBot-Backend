function roundToTwo(value) {
  return Number(Number(value || 0).toFixed(2));
}

function clampMinimumZero(value) {
  return Math.max(0, roundToTwo(value));
}

function getWeightedRunRate({
  spentSoFar,
  dayOfMonth,
  daysInMonth,
  transactions,
  avgDailySpend,
}) {
  if (spentSoFar <= 0 || dayOfMonth <= 0 || daysInMonth <= 0) {
    return 0;
  }

  const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);
  const linearProjection = (spentSoFar / dayOfMonth) * daysInMonth;
  const recentPaceProjection = spentSoFar + avgDailySpend * daysRemaining;

  // Small transaction counts can be noisy, so keep the forecast conservative.
  const activityWeight = Math.min(Math.max(transactions / 10, 0.25), 0.75);
  const blendedProjection =
    linearProjection * activityWeight + recentPaceProjection * (1 - activityWeight);

  return clampMinimumZero(blendedProjection);
}

/**
 * Local placeholder prediction service.
 * TODO: Replace with local trained ML model prediction service or Flask API.
 */
async function predictFinalSpendLocal({
  dayOfMonth,
  daysInMonth,
  spentSoFar,
  transactions,
  avgDailySpend,
}) {
  return getWeightedRunRate({
    spentSoFar,
    dayOfMonth,
    daysInMonth,
    transactions,
    avgDailySpend,
  });
}

module.exports = {
  predictFinalSpendLocal,
  getWeightedRunRate,
};
