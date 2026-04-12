const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  console.log("EC2 -> Lambda로 전달된 데이터", event.body);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let inputData;
  try {
    inputData = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (error) {
    console.error("JSON 파싱 오류:", error);
    return { statusCode: 400, body: "Invalid JSON format" };
  }

  if (!inputData || !inputData.books || !Array.isArray(inputData.books)) {
    console.error("Invalid request: No books provided");
    return { statusCode: 400, body: "No books provided" };
  }

  const books = inputData.books;
  console.log("추천 요청 도서 목록:", books.length, "권");

  try {
    const bookList = books
      .map(
        (b) =>
          `- "${b.title}" (${b.author}) ★${b.rating} ${b.comment ? `| 코멘트: ${b.comment}` : ""}`
      )
      .join("\n");

    const prompt = `당신은 도서 추천 전문가입니다. 아래는 사용자의 독서 기록입니다.

${bookList}

아래 형식에 맞춰 답변해주세요. 한국어로 답변해주세요.

### 독서 기록 분석
기록된 ${books.length}권에 대한 전체적인 장르, 분위기, 평점 패턴을 3문장 이내로 요약해주세요. 개별 도서를 하나씩 분석하지 말고 전체적인 경향만 짧게 정리해주세요.

### 추천 도서
위 분석을 바탕으로 비슷한 책 3권을 추천해주세요.
1. 📖 [책 제목] - [저자]
   추천 이유: (2~3문장)
2. 📖 [책 제목] - [저자]
   추천 이유: (2~3문장)
3. 📖 [책 제목] - [저자]
   추천 이유: (2~3문장)`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text();

    console.log("AI 추천 결과 수신 완료");

    return {
      statusCode: 200,
      body: aiResponse,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: "AI 추천 실패",
    };
  }
};
