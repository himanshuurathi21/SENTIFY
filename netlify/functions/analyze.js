const vader = require('vader-sentiment');

const negativeKeywords = ['breakup', 'failed', 'accident', 'death', 'hated'];

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { text } = JSON.parse(event.body);
    if (!text || !text.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Text is required" }) };
    }

    let pos, neu, neg;

    const hasNegativeKeyword = negativeKeywords.some(k => text.toLowerCase().includes(k));

    if (hasNegativeKeyword) {
      pos = 0.01;
      neu = 0.01;
      neg = 0.98;
    } else {
      const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(text);
      pos = intensity.pos;
      neu = intensity.neu;
      neg = intensity.neg;
    }

    const data = [
      { Label: "Positive", Score: Math.round(pos * 10000) / 100 },
      { Label: "Neutral", Score: Math.round(neu * 10000) / 100 },
      { Label: "Negative", Score: Math.round(neg * 10000) / 100 }
    ];

    const best = data.reduce((a, b) => a.Score > b.Score ? a : b);
    let val;
    if (best.Label === "Positive") {
      val = Math.round(66 + (best.Score / 3));
    } else if (best.Label === "Negative") {
      val = Math.round(33 - (best.Score / 3));
    } else {
      val = 50;
    }

    const bestLabel = best.Label;
    let emoji;
    if (bestLabel === "Positive") emoji = "😊";
    else if (bestLabel === "Negative") emoji = "😡";
    else emoji = "😐";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ scores: data, gaugeValue: val, bestLabel, emoji })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" })
    };
  }
};
