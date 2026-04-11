const axios = require("axios");

const AI_TIMEOUT_MS = 20000;
const AI_MAX_ATTEMPTS = 3; // 1 initial + 2 retries

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetriableAiError(error) {
  const status = error?.response?.status;
  const code = error?.code;

  if (status === 502 || status === 503 || status === 504) return true;
  if (code === "ECONNABORTED") return true; // timeout
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ECONNRESET")
    return true;
  if (!error?.response) return true; // network-level errors

  return false;
}

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

  const predictUrl = `${baseUrl.replace(/\/$/, "")}/predict`;
  const payload = {
    day_of_month: dayOfMonth,
    category,
    spent_so_far: spentSoFar,
    transactions,
    avg_daily_spend: avgDailySpend,
  };

  console.log("AI request started", {
    category,
    dayOfMonth,
    timeoutMs: AI_TIMEOUT_MS,
    maxAttempts: AI_MAX_ATTEMPTS,
  });

  let lastError;

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.post(predictUrl, payload, {
        timeout: AI_TIMEOUT_MS,
      });

      const predictedFinalSpend = Number(response?.data?.predictedFinalSpend);
      if (!Number.isFinite(predictedFinalSpend)) {
        throw new Error("ML service returned invalid predictedFinalSpend");
      }

      console.log("AI request succeeded", {
        category,
        attempt,
        predictedFinalSpend,
      });

      return predictedFinalSpend;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || "NO_STATUS";
      const code = error?.code || "NO_CODE";
      console.warn(`AI request failed attempt ${attempt}`, {
        category,
        status,
        code,
        message: error.message,
      });

      const shouldRetry =
        attempt < AI_MAX_ATTEMPTS && isRetriableAiError(error);
      if (!shouldRetry) {
        break;
      }

      // Small backoff to allow Render free-tier cold starts to wake.
      await sleep(1000 * attempt);
    }
  }

  console.error("AI retries exhausted, escalating to fallback", {
    category,
    attempts: AI_MAX_ATTEMPTS,
    lastMessage: lastError?.message,
  });
  throw lastError || new Error("AI prediction failed after retries");
}

module.exports = {
  predictFinalSpendML,
};
