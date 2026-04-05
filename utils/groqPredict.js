const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function linearFallback({ spentSoFar, dayOfMonth, daysInMonth }) {
  if (dayOfMonth <= 0) return 0;
  const projected = (spentSoFar / dayOfMonth) * daysInMonth;
  return Math.max(0, Number(projected.toFixed(2)));
}

function parsePredictedSpend(content) {
  const trimmed = String(content || "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const n = Number(obj.predicted_final_spend);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  } catch {
    return null;
  }
}

/**
 * Forecast category spend by month-end using Groq; falls back to linear run-rate if no key or on error.
 */
async function predictFinalSpendGroq({
  dayOfMonth,
  daysInMonth,
  category,
  spentSoFar,
  transactions,
  avgDailySpend,
}) {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) {
    return linearFallback({ spentSoFar, dayOfMonth, daysInMonth });
  }

  if (spentSoFar <= 0 && transactions === 0) {
    return 0;
  }

  const model =
    process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const userPrompt = `Estimate total spending in category "${category}" by the end of this calendar month.

Context:
- Today is day ${dayOfMonth} of the month (out of ${daysInMonth} days).
- Spent so far this month: ${spentSoFar}
- Number of transactions: ${transactions}
- Average daily spend so far: ${avgDailySpend}

Reply with ONLY valid JSON (no markdown): {"predicted_final_spend": <number>}
Use the same currency units as "spent so far". The number must be >= 0. If the user is on track to stay flat, still output a realistic month-end total.`;

  try {
    const { data: body, status } = await axios.post(
      GROQ_API_URL,
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a budgeting forecast assistant. Respond only with valid JSON containing a single numeric field: predicted_final_spend. No markdown or explanation.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 256,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    if (status < 200 || status >= 300) {
      console.error(
        "[Groq] API error:",
        status,
        typeof body === "object" ? JSON.stringify(body).slice(0, 500) : String(body).slice(0, 500)
      );
      return linearFallback({ spentSoFar, dayOfMonth, daysInMonth });
    }

    const content = body.choices?.[0]?.message?.content?.trim() || "";
    const parsed = parsePredictedSpend(content);
    if (parsed === null) {
      console.warn("[Groq] Unparseable response:", content.slice(0, 200));
      return linearFallback({ spentSoFar, dayOfMonth, daysInMonth });
    }
    return Number(parsed.toFixed(2));
  } catch (e) {
    console.error(
      "[Groq] Request failed:",
      e.response?.data ? JSON.stringify(e.response.data).slice(0, 300) : e.message
    );
    return linearFallback({ spentSoFar, dayOfMonth, daysInMonth });
  }
}

module.exports = {
  predictFinalSpendGroq,
  linearFallback,
};
