require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const port = 80;

app.use(cors());
app.use(express.json());

// ── Lambda 함수 URL ──
const LAMBDA_URL = process.env.LAMBDA_URL;

// ── DB 커넥션 풀 (자동 재연결) ──
let pool = null;

const connectToDatabase = () => {
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error("누락된 환경변수:", missing.join(", "));
    return Promise.reject(new Error("환경변수 누락"));
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    idleTimeout: 60000,
  });

  return new Promise((resolve, reject) => {
    pool.query("SELECT 1", async (err) => {
      if (err) {
        console.error("DB 연결 실패:", err.message);
        return reject(err);
      }
      console.log("DB 연결 성공");
      try {
        await createBooksTable();
        resolve(pool);
      } catch (e) {
        reject(e);
      }
    });
  });
};

const createBooksTable = () =>
  new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
    pool.query(sql, (err, result) => {
      if (err) return reject(err);
      console.log("books 테이블 준비 완료");
      resolve(result);
    });
  });

// ── 미들웨어 ──
const checkDb = (req, res, next) => {
  if (!pool)
    return res.status(503).json({ error: "DB 연결 안됨" });
  next();
};

// ── 라우트 ──

// 서버 상태
app.get("/", (req, res) => {
  res.json({
    message: "BookLog 서버 실행 중",
    status: {
      database: pool ? "연결됨" : "연결 안됨",
      lambda: LAMBDA_URL ? "설정됨" : "설정 안됨",
    },
  });
});

// 전체 도서 조회
app.get("/books", checkDb, (req, res) => {
  pool.query(
    "SELECT * FROM books ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ error: "조회 실패" });
      res.json(results);
    }
  );
});

// 도서 추가
app.post("/books", checkDb, (req, res) => {
  const { title, author, rating, comment } = req.body;
  if (!title || !author || !rating)
    return res.status(400).json({ error: "제목, 저자, 별점은 필수입니다" });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ error: "별점은 1~5 사이여야 합니다" });

  pool.query(
    "INSERT INTO books SET ?",
    { title, author, rating, comment: comment || "" },
    (err, result) => {
      if (err) return res.status(500).json({ error: "저장 실패" });
      res.status(201).json({ message: "저장 완료", id: result.insertId });
    }
  );
});

// AI 도서 추천 (Lambda 함수 URL 호출)
app.get("/books/recommend", checkDb, async (req, res) => {
  if (!LAMBDA_URL)
    return res.status(503).json({ error: "AI 서비스 설정 안됨" });

  pool.query(
    "SELECT title, author, rating, comment FROM books ORDER BY created_at DESC LIMIT 20",
    async (err, books) => {
      if (err) return res.status(500).json({ error: "조회 실패" });
      if (books.length === 0)
        return res.status(400).json({ error: "등록된 도서가 없어 추천할 수 없습니다" });

      try {
        const response = await fetch(LAMBDA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ books }),
        });

        if (!response.ok) throw new Error(`Lambda 응답 오류: ${response.status}`);

        const text = await response.text();
        res.json({ recommendation: text });
      } catch (e) {
        console.error("Lambda 호출 오류:", e.message);
        res.status(500).json({ error: "AI 추천 실패" });
      }
    }
  );
});

// 독서 통계
app.get("/books/stats", checkDb, (req, res) => {
  const sql = `
    SELECT
      COUNT(*) AS totalBooks,
      ROUND(AVG(rating), 1) AS avgRating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS star5,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS star4,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS star3,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS star2,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS star1
    FROM books`;
  pool.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "통계 조회 실패" });
    const stats = results[0];
    pool.query(
      "SELECT title, author, rating FROM books ORDER BY created_at DESC LIMIT 3",
      (err2, recent) => {
        if (err2) return res.status(500).json({ error: "통계 조회 실패" });
        res.json({ ...stats, recentBooks: recent });
      }
    );
  });
});

// 도서 삭제
app.delete("/books/:id", checkDb, (req, res) => {
  pool.query(
    "DELETE FROM books WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "삭제 실패" });
      if (result.affectedRows === 0)
        return res.status(404).json({ error: "해당 도서를 찾을 수 없습니다" });
      res.json({ message: "삭제 완료" });
    }
  );
});

// ── 에러 핸들러 ──
app.use((err, req, res, next) => {
  console.error("서버 오류:", err);
  res.status(500).json({ error: "서버 오류 발생" });
});

// ── 서버 시작 ──
const startServer = async () => {
  try {
    await connectToDatabase();
    app.listen(port, () => {
      console.log(`\n=== BookLog 서버 ===`);
      console.log(`포트: ${port}`);
      console.log(`DB: ${pool ? "연결됨 ✅" : "실패 ❌"}`);
      console.log(`Lambda: ${LAMBDA_URL ? "설정됨 ✅" : "설정 안됨 ❌"}`);
      console.log(`====================\n`);
    });
  } catch (error) {
    console.error("서버 시작 실패:", error.message);
    process.exit(1);
  }
};

process.on("uncaughtException", (err) => {
  console.error("처리되지 않은 에러:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("처리되지 않은 Promise 거부:", err);
});

startServer();
