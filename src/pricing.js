const CACHE_MS = 5 * 60 * 1000;
let cache = { expiresAt: 0, pricePerGramTry: 0 };

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`API error ${response.status} for ${url}`);
  }
  return response.json();
}

async function getXauUsdPerOunce() {
  // metals.live returns arrays like [[timestamp, price], ...] on /spot/gold.
  const data = await fetchJson("https://api.metals.live/v1/spot/gold");
  if (!Array.isArray(data) || !Array.isArray(data[0]) || typeof data[0][1] !== "number") {
    throw new Error("Unexpected metals.live response");
  }
  return data[0][1];
}

async function getXauUsdPerOunceFromYahoo() {
  const data = await fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d");
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("Unexpected Yahoo gold response");
  }
  return price;
}

async function getXauUsdPerOunceFromStooq() {
  const response = await fetch("https://stooq.com/q/l/?s=xauusd&i=d", {
    headers: { Accept: "text/plain" },
  });
  if (!response.ok) {
    throw new Error(`Stooq error ${response.status}`);
  }

  const text = await response.text();
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const quoteLine = lines.find((line) => line.toUpperCase().startsWith("XAUUSD,"));
  if (!quoteLine) {
    throw new Error("Unexpected stooq response");
  }
  const cols = quoteLine.split(",");
  const close = Number(cols[6] || cols[cols.length - 1]);
  if (!Number.isFinite(close) || close <= 0) {
    throw new Error("Invalid stooq close value");
  }
  return close;
}

async function getUsdTry() {
  // Open ER API is free and no-key.
  const data = await fetchJson("https://open.er-api.com/v6/latest/USD");
  const tryRate = data?.rates?.TRY;
  if (typeof tryRate !== "number" || Number.isNaN(tryRate)) {
    throw new Error("Unexpected FX response");
  }
  return tryRate;
}

async function getUsdTryFromFrankfurter() {
  const data = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY");
  const tryRate = data?.rates?.TRY;
  if (typeof tryRate !== "number" || Number.isNaN(tryRate)) {
    throw new Error("Unexpected frankfurter FX response");
  }
  return tryRate;
}

async function firstSuccessful(tasks, errorPrefix) {
  let lastError = null;
  for (const task of tasks) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`${errorPrefix}: ${lastError?.message || "all providers failed"}`);
}

async function resolvePricePerGramTry() {
  const now = Date.now();
  if (cache.expiresAt > now && cache.pricePerGramTry > 0) {
    return cache.pricePerGramTry;
  }

  try {
    const [xauUsdPerOunce, usdTry] = await Promise.all([
      firstSuccessful([getXauUsdPerOunceFromYahoo, getXauUsdPerOunce, getXauUsdPerOunceFromStooq], "Gold provider failed"),
      firstSuccessful([getUsdTry, getUsdTryFromFrankfurter], "FX provider failed"),
    ]);
    const gramsPerOunce = 31.1034768;
    const gramTry = (xauUsdPerOunce * usdTry) / gramsPerOunce;
    cache = { expiresAt: now + CACHE_MS, pricePerGramTry: gramTry };
    return gramTry;
  } catch (_fallbackError) {
    // Final fallback when external providers fail.
    const fallback = 4200;
    cache = { expiresAt: now + 60 * 1000, pricePerGramTry: fallback };
    return fallback;
  }
}

module.exports = { resolvePricePerGramTry };
