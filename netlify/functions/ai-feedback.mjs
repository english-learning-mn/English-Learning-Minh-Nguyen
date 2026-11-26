
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

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:'"()[\]{}]/g, "")
    .trim();
}

function removeDuplicateCorrections(corrections) {
  if (!Array.isArray(corrections)) return [];

  const seen = new Set();

  return corrections.filter(item => {
    if (!item || typeof item !== "object") return false;

    const key = [
      normalizeText(item.original),
      normalizeText(item.corrected),
      normalizeText(item.category)
    ].join("|");

    if (!item.original || !item.corrected || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .filter(item => typeof item === "string" && item.trim())
      .map(item => item.trim())
  )];
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({
      error: "Phương thức truy cập không được hỗ trợ."
    }, 405);
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return jsonResponse({
      error: "Chưa cấu hình Groq AI. Vui lòng kiểm tra GROQ_API_KEY."
    }, 503);
  }

  let body;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({
      error: "Dữ liệu gửi lên không hợp lệ."
    }, 400);
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
      error: "Vui lòng cung cấp nội dung bài tập và câu trả lời hợp lệ."
    }, 400);
  }

  if (!studentAnswer.trim()) {
    return jsonResponse({
      error: "Bạn chưa nhập câu trả lời."
    }, 400);
  }

  const system = `Bạn là một giáo viên tiếng Anh giàu kinh nghiệm, thân thiện và có khả năng hướng dẫn học sinh.

Nhiệm vụ: Đánh giá câu trả lời tiếng Anh của học sinh theo trình độ CEFR ${level.slice(0, 10)}.

QUY TẮC ĐÁNH GIÁ:

1. Chấp nhận tất cả các cách diễn đạt đúng về ngữ pháp và ý nghĩa.
2. Không bắt buộc học sinh phải viết giống hoàn toàn đáp án tham khảo.
3. Chỉ chỉ ra lỗi thực sự, không coi sở thích diễn đạt cá nhân là lỗi.
4. Không tự tạo ra lỗi sai.
5. Nếu câu trả lời đã đúng, hãy khẳng định rõ ràng và không tạo lỗi cần sửa.
6. TẤT CẢ nhận xét, giải thích, hướng dẫn và nội dung phản hồi phải được viết bằng TIẾNG VIỆT.
7. Chỉ giữ tiếng Anh ở những phần cần thiết như câu trả lời của học sinh, từ/cụm từ gốc, câu sửa và ví dụ tiếng Anh.

QUY TẮC CHỈ RA LỖI:

- Mỗi lỗi riêng biệt chỉ được nêu một lần.
- Không lặp lại toàn bộ câu khi chỉ có một từ hoặc một cụm từ sai.
- Trường "original" chỉ chứa từ hoặc cụm từ sai.
- Trường "corrected" chỉ chứa từ hoặc cụm từ được sửa.
- Trường "reason" giải thích bằng tiếng Việt, dễ hiểu và phù hợp với học sinh.
- Không tạo các lỗi trùng lặp.
- Phân loại lỗi bằng một trong các nhãn: "Ngữ pháp", "Từ vựng", "Chọn từ", "Chính tả", "Dấu câu".

ĐÁNH GIÁ 4 TIÊU CHÍ:

1. meaning: Mức độ bảo toàn ý nghĩa.
2. grammar: Độ chính xác về ngữ pháp.
3. vocabulary: Mức độ chính xác và phù hợp của từ vựng.
4. naturalness: Độ tự nhiên của cách diễn đạt.

Mỗi tiêu chí gồm:
- status: một trong các mức "Tốt", "Khá tốt", "Cần cải thiện", "Chưa đủ dữ liệu".
- feedback: nhận xét ngắn gọn bằng tiếng Việt.

Hãy trả về JSON hợp lệ, không thêm lời dẫn bên ngoài JSON, theo đúng cấu trúc sau:

{
  "overall": "Nhận xét chung bằng tiếng Việt",
  "dimensions": {
    "meaning": {
      "status": "Tốt",
      "feedback": "..."
    },
    "grammar": {
      "status": "Cần cải thiện",
      "feedback": "..."
    },
    "vocabulary": {
      "status": "Tốt",
      "feedback": "..."
    },
    "naturalness": {
      "status": "Khá tốt",
      "feedback": "..."
    }
  },
  "meaning_summary": "Nhận xét về mức độ bảo toàn ý nghĩa",
  "corrections": [
    {
      "original": "read",
      "corrected": "reading",
      "reason": "Sau cấu trúc spend time, động từ theo sau cần ở dạng V-ing.",
      "category": "Ngữ pháp"
    }
  ],
  "strengths": [
    "Điểm học sinh đã làm tốt, viết bằng tiếng Việt"
  ],
  "improved_version": "Câu hoặc đoạn văn tiếng Anh đã được chỉnh sửa hoàn chỉnh",
  "alternative_answers": [
    "Một cách diễn đạt đúng khác bằng tiếng Anh"
  ],
  "next_step": "Gợi ý luyện tập cụ thể bằng tiếng Việt"
}

YÊU CẦU CUỐI CÙNG:

- Không cho điểm số hoặc IELTS band score.
- Không dùng tiếng Anh cho các tiêu đề, nhận xét hoặc lời giải thích hiển thị với học sinh.
- Câu tiếng Anh chỉ xuất hiện khi trích dẫn, sửa lỗi hoặc đưa ra ví dụ.
- Phản hồi ngắn gọn, rõ ràng, có tính hướng dẫn.
- Nếu học sinh không mắc lỗi, hãy khuyến khích và giải thích vì sao câu trả lời đúng.`;

  const user = `Loại bài tập: ${taskType}

Yêu cầu bài tập:
${prompt}

Đáp án tham khảo (nếu có, không phải đáp án duy nhất):
${referenceAnswer}

Câu trả lời của học sinh:
${studentAnswer}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${apiKey}\`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0.2,
          max_completion_tokens: 2500,
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
        error: "Không thể kết nối với AI.",
        detail: data?.error?.message || "Lỗi không xác định."
      }, 502);
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI không trả về nội dung.");
    }

    let result;

    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("Phản hồi AI không đúng định dạng.");
    }

    result.corrections = removeDuplicateCorrections(
      result.corrections
    );

    result.strengths = cleanList(result.strengths);
    result.alternative_answers = cleanList(
      result.alternative_answers
    );

    return jsonResponse({ result }, 200);

  } catch (error) {
    console.error("AI feedback error:", error.message);

    return jsonResponse({
      error: "Không thể tạo nhận xét.",
      detail: error.message
    }, 500);
  }
};
