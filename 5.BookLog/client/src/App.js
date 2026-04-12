import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = process.env.REACT_APP_SERVER_URL;

function StarRating({ value, onChange, readOnly }) {
  return (
    <span className="stars" role="group" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "star filled" : "star"}
          onClick={() => !readOnly && onChange(n)}
          disabled={readOnly}
          aria-label={`${n}점`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function RatingBar({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rating-bar-row">
      <span className="rating-bar-label">{label}</span>
      <div className="rating-bar-track">
        <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="rating-bar-count">{count}권</span>
    </div>
  );
}

export default function App() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/books`);
      if (!res.ok) throw new Error("서버 응답 오류");
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError("도서 목록을 불러올 수 없습니다.");
      setBooks([]);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/books/stats`);
      if (!res.ok) throw new Error("통계 조회 실패");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
    fetchStats();
  }, [fetchBooks, fetchStats]);

  const addBook = async (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || rating === 0) {
      setError("제목, 저자, 별점을 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, rating, comment }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setTitle("");
      setAuthor("");
      setRating(0);
      setComment("");
      await fetchBooks();
      await fetchStats();
    } catch (e) {
      setError("도서 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (id) => {
    if (!window.confirm("이 도서를 삭제하시겠습니까?")) return;
    try {
      await fetch(`${API}/books/${id}`, { method: "DELETE" });
      await fetchBooks();
      await fetchStats();
    } catch (e) {
      setError("삭제에 실패했습니다.");
    }
  };

  const getRecommendation = async () => {
    setAiLoading(true);
    setRecommendation("");
    setError("");
    try {
      const res = await fetch(`${API}/books/recommend`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "추천 실패");
      }
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (e) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>📚 BookLog</h1>
        <p>나의 독서 기록 &amp; AI 도서 추천</p>
      </header>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="add-section">
        <h2>새 도서 등록</h2>
        <form onSubmit={addBook} className="book-form">
          <div className="form-row">
            <label htmlFor="title">제목</label>
            <input
              id="title"
              type="text"
              placeholder="책 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="author">저자</label>
            <input
              id="author"
              type="text"
              placeholder="저자"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>별점</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="form-row">
            <label htmlFor="comment">코멘트</label>
            <textarea
              id="comment"
              placeholder="한줄평을 남겨보세요 (선택)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "저장 중..." : "등록하기"}
          </button>
        </form>
      </section>

      <section className="recommend-section">
        <h2>🤖 AI 도서 추천</h2>
        <p className="recommend-desc">내 독서 기록을 분석해서 비슷한 책을 추천받아 보세요.</p>
        <button
          className="btn btn-ai"
          onClick={getRecommendation}
          disabled={aiLoading || books.length === 0}
        >
          {aiLoading ? "분석 중..." : "추천받기"}
        </button>
        {recommendation && (
          <div className="recommendation-box">
            {recommendation.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </section>

      {stats && stats.totalBooks > 0 && (
        <section className="stats-section">
          <h2>📊 내 독서 통계</h2>
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-number">{stats.totalBooks}</span>
              <span className="stat-label">총 읽은 책</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.avgRating ?? "-"}</span>
              <span className="stat-label">평균 별점</span>
            </div>
          </div>
          <div className="rating-distribution">
            <h3>별점 분포</h3>
            <RatingBar label="★5" count={stats.star5} total={stats.totalBooks} />
            <RatingBar label="★4" count={stats.star4} total={stats.totalBooks} />
            <RatingBar label="★3" count={stats.star3} total={stats.totalBooks} />
            <RatingBar label="★2" count={stats.star2} total={stats.totalBooks} />
            <RatingBar label="★1" count={stats.star1} total={stats.totalBooks} />
          </div>
          {stats.recentBooks && stats.recentBooks.length > 0 && (
            <div className="recent-books">
              <h3>최근 등록</h3>
              {stats.recentBooks.map((b, i) => (
                <span key={i} className="recent-tag">
                  {b.title} ★{b.rating}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="list-section">
        <h2>내 독서 기록 ({books.length}권)</h2>
        {books.length === 0 ? (
          <p className="empty">아직 등록된 도서가 없습니다.</p>
        ) : (
          <ul className="book-list">
            {books.map((book) => (
              <li key={book.id} className="book-card">
                <div className="book-info">
                  <strong className="book-title">{book.title}</strong>
                  <span className="book-author">{book.author}</span>
                  <StarRating value={book.rating} readOnly />
                  {book.comment && <p className="book-comment">{book.comment}</p>}
                </div>
                <button
                  className="btn btn-delete"
                  onClick={() => deleteBook(book.id)}
                  aria-label={`${book.title} 삭제`}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
