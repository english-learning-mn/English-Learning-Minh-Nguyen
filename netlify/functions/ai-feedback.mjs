// Netlify Function: Groq AI feedback endpoint.
// Keep GROQ_API_KEY in Netlify Environment Variables.
// Never expose the API key in browser code.

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return jsonResponse({
      error: "Groq AI is not configured. Please check GROQ_API_KEY."
    }, 503);
  }

  let body;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const {
    taskType = "translation",
    prompt,
    studentAnswer,
    referenceAnswer = "",
    level = "B1"
  } = body ?? {};

  if (
    !["translation", "writing", "speaking_text"].includes(taskType) ||
    typeof prompt !== "string" ||
    typeof studentAnswer !== "string" ||
    typeof referenceAnswer !== "string" ||
    typeof level !== "string" ||
    prompt.length > 5000 ||
    studentAnswer.length > 8000 ||
    referenceAnswer.length > 8000
  ) {
    return jsonResponse({
      error: "Please provide valid exercise content and an answer."
    }, 400);
  }

  if (!studentAnswer.trim()) {
    return jsonResponse({
      error: "Student answer cannot be empty."
    }, 400);
  }

  const system = `You are an encouraging English-language learning assistant.

Assess the learner's answer at CEFR level ${level.slice(0, 10)}.

Accept all grammatically and semantically valid alternatives.
Do not require an exact match to the reference answer.
Distinguish genuine errors from stylistic preferences.
Do not invent errors.

Return valid JSON only, with this exact structure:
{
  "overall": "short overall feedback",
  "meaning": "whether the intended meaning is preserved",
  "corrections": [
    {
      "original": "...",
      "corrected": "...",
      "reason": "...",
      "category": "grammar|vocabulary|word_choice|spelling|punctuation"
    }
  ],
  "strengths": ["..."],
  "improved_version": "...",
  "alternative_answers": ["..."],
  "next_step": "..."
}

If the answer is already correct, corrections must be an empty array.
Keep feedback age-appropriate, concise, and educational.
Explain corrections clearly.`;

  const user = `Task type: ${taskType}

Exercise prompt:
${prompt}

Reference answer (optional; not the only acceptable answer):
${referenceAnswer}

Student answer:
${studentAnswer}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0.2,
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data?.error?.message);

      return jsonResponse({
        error: "Groq AI request failed.",
        detail: data?.error?.message || "Unknown provider error."
      }, 502);
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from Groq.");
    }

    let result;

    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("AI response was not valid JSON.");
    }

    return jsonResponse({ result }, 200);

  } catch (error) {
    console.error("AI feedback error:", error.message);

    return jsonResponse({
      error: "Could not generate feedback.",
      detail: error.message
    }, 500);
  }
};
