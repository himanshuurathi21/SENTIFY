const HF_API_URL = "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest";

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

    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text })
    };

    const hfToken = process.env.HF_API_TOKEN;
    if (hfToken) {
      fetchOptions.headers["Authorization"] = `Bearer ${hfToken}`;
    }

    const response = await fetch(HF_API_URL, fetchOptions);

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errBody = await response.json();
        errorDetail = errBody.error || "";
      } catch (_) {}

      if (response.status === 503 && errorDetail.includes("loading")) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: "loading",
            message: "Model is loading. Please try again in a few seconds."
          })
        };
      }

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errorDetail || "Model API error" })
      };
    }

    const result = await response.json();
    if (!result || !Array.isArray(result) || !result[0]) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Unexpected API response format" }) };
    }

    const scores = result[0];
    const labelMap = { "LABEL_0": "Negative", "LABEL_1": "Neutral", "LABEL_2": "Positive" };

    const data = scores.map(item => ({
      Label: labelMap[item.label] || item.label,
      Score: Math.round(item.score * 10000) / 100
    }));

    const best = data.reduce((a, b) => a.Score > b.Score ? a : b);
    let val;
    if (best.Label === "Positive") {
      val = Math.round(66 + (best.Score / 3));
    } else if (best.Label === "Negative") {
      val = Math.round(33 - (best.Score / 3));
    } else {
      val = 50;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ scores: data, gaugeValue: val })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" })
    };
  }
};
