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
  // metals.live returns arrays like [[timestamp, price], ...] on /spot/gold
  const data = await fetchJson("https://api.metals.live/v1/spot/gold");
  if (!Array.isArray(data) || !Array.isArray(data[0]) || typeof data[0][1] !== "number") {
    throw new Error("Unexpected metals.live response");
  }
  return data[0][1];
}

async function getUsdTry() {
  // exchangerate host often returns stable no-key data on latest endpoint
  const data = await fetchJson("https://open.er-api.com/v6/latest/USD");
  const tryRate = data?.rates?.TRY;
  if (typeof tryRate !== "number" || Number.isNaN(tryRate)) {
    throw new Error("Unexpected FX response");
  }
  return tryRate;
}

async function resolvePricePerGramTry() {
  const now = Date.now();
  if (cache.expiresAt > now && cache.pricePerGramTry > 0) {
    return cache.pricePerGramTry;
  }

  try {
    const [xauUsdPerOunce, usdTry] = await Promise.all([getXauUsdPerOunce(), getUsdTry()]);
    const gramsPerOunce = 31.1034768;
    const gramTry = (xauUsdPerOunce * usdTry) / gramsPerOunce;
    cache = { expiresAt: now + CACHE_MS, pricePerGramTry: gramTry };
    return gramTry;
  } catch (_error) {
    // Fallback to a sane value when external providers fail.
    const fallback = 4200;
    cache = { expiresAt: now + 60 * 1000, pricePerGramTry: fallback };
    return fallback;
  }
}

module.exports = { resolvePricePerGramTry };
