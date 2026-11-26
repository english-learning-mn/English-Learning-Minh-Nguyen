// Netlify Function: secure server-side AI feedback endpoint.
// Set OPENAI_API_KEY in Netlify environment variables. Never put it in browser code.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "content-type": "application/json" }
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI service is not configured yet." }), {
      status: 503, headers: { "content-type": "application/json" }
    });
  }

  let body;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400, headers: { "content-type": "application/json" }
    });
  }

  const { taskType = "translation", prompt, studentAnswer, referenceAnswer = "", level = "B1" } = body ?? {};
  if (![ "translation", "writing", "speaking_text" ].includes(taskType) ||
      typeof prompt !== "string" || typeof studentAnswer !== "string" ||
      prompt.length > 5000 || studentAnswer.length > 8000 || referenceAnswer.length > 8000) {
    return new Response(JSON.stringify({ error: "Please provide valid exercise content and an answer." }), {
      status: 400, headers: { "content-type": "application/json" }
    });
  }
  if (!studentAnswer.trim()) {
    return new Response(JSON.stringify({ error: "Student answer cannot be empty." }), {
      status: 400, headers: { "content-type": "application/json" }
    });
  }

  const system = `You are an encouraging English-language learning assistant.
Assess the learner's answer at CEFR level ${String(level).slice(0, 10)}.
Accept all grammatically and semantically valid alternatives; do not require an exact match to the reference.
Distinguish genuine errors from stylistic preferences. Do not invent errors.
Return valid JSON only, with this shape:
{
 "overall":"short overall feedback",
 "meaning":"whether the intended meaning is preserved",
 "corrections":[{"original":"...","corrected":"...","reason":"...","category":"grammar|vocabulary|word_choice|spelling|punctuation"}],
 "strengths":["..."],
 "improved_version":"...",
 "alternative_answers":["..."],
 "next_step":"..."
}
If the answer is already correct, corrections must be an empty array. Keep feedback age-appropriate, concise, and educational.`;

  const user = `Task type: ${taskType}
Exercise prompt: ${prompt}
Reference answer (optional; not the only acceptable answer): ${referenceAnswer}
Student answer: ${studentAnswer}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "AI provider request failed.", detail: data?.error?.message || "Unknown provider error." }), {
        status: 502, headers: { "content-type": "application/json" }
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    let result;
    try { result = JSON.parse(content); }
    catch { throw new Error("AI response was not valid JSON."); }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Could not generate feedback.", detail: error.message }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
};
