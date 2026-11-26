import { MessageSquare, Star } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { discussionsApi, getErrorMessage } from '../lib/api';
import type { BookQuestion, BookReview } from '../types';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-[#1B4D3E] text-[#1B4D3E]' : 'text-[#D6CFC2]'
          }`}
        />
      ))}
    </div>
  );
}

export function BookDiscussions({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'reviews' | 'qa'>('reviews');

  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [questions, setQuestions] = useState<BookQuestion[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [finishedReading, setFinishedReading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Ask question form state
  const [questionText, setQuestionText] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  // Answer inline state
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [hasReadBook, setHasReadBook] = useState(true);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const loadDiscussions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await discussionsApi.getByBookId(bookId);
      const nextReviews = Array.isArray(data.reviews) ? data.reviews : [];
      const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
      setReviews(nextReviews);
      setQuestions(nextQuestions);
      setAverageRating(data.averageRating || 0);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Unable to load book discussions.'));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void loadDiscussions();
  }, [loadDiscussions]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const data = await discussionsApi.addReview(bookId, {
        rating,
        comment,
        finishedReading,
      });
      const nextReviews = [data.review, ...reviews];
      setReviews(nextReviews);
      const avg =
        nextReviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, nextReviews.length);
      setAverageRating(Number(avg.toFixed(1)));
      setComment('');
      setRating(5);
    } catch (err) {
      setReviewError(getErrorMessage(err, 'Failed to submit review.'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionSubmitting(true);
    setQuestionError(null);
    try {
      const data = await discussionsApi.addQuestion(bookId, questionText);
      setQuestions((prev) => [data.question, ...prev]);
      setQuestionText('');
    } catch (err) {
      setQuestionError(getErrorMessage(err, 'Failed to submit question.'));
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent, questionId: string) => {
    e.preventDefault();
    setAnswerSubmitting(true);
    setAnswerError(null);
    try {
      const data = await discussionsApi.addAnswer(questionId, {
        body: answerText,
        hasReadBook,
      });
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? data.question : q)));
      setAnsweringId(null);
      setAnswerText('');
    } catch (err) {
      setAnswerError(getErrorMessage(err, 'Failed to post answer.'));
    } finally {
      setAnswerSubmitting(false);
    }
  };

  return (
    <section className="mt-14 pt-10 border-t border-[#E5DFD3] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D]">
            Reader reviews &amp; Q&amp;A
          </h2>
          <p className="text-sm text-[#5C615D] mt-1">
            Read impressions from people who finished {bookTitle}, or ask a question for past readers
            to answer.
          </p>
        </div>

        {/* Segmented Tabs */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg self-start sm:self-auto"
          role="tablist"
          aria-label="Reviews and questions tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
              activeTab === 'reviews'
                ? 'bg-[#1B4D3E] text-[#FAF7F2]'
                : 'text-[#5C615D] hover:text-[#1C1F1D]'
            }`}
          >
            Reviews ({reviews.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'qa'}
            onClick={() => setActiveTab('qa')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
              activeTab === 'qa'
                ? 'bg-[#1B4D3E] text-[#FAF7F2]'
                : 'text-[#5C615D] hover:text-[#1C1F1D]'
            }`}
          >
            Questions &amp; Answers ({questions.length})
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadDiscussions()}
            className="px-4 py-2 rounded-lg border border-[#1B4D3E] text-sm font-semibold text-[#1B4D3E] cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="h-36 rounded-xl bg-[#F3EFE6] animate-pulse" />
      ) : activeTab === 'reviews' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Write a Review */}
          <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-6 space-y-4">
            <div className="flex items-baseline justify-between pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">Write a review</h3>
              {reviews.length > 0 && (
                <span className="text-sm font-semibold text-[#1B4D3E] tabular-nums">
                  {averageRating} / 5 avg
                </span>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="space-y-3 text-sm text-[#5C615D]">
                <p>Sign in to share your rating and review of this book.</p>
                <Link
                  to="/login"
                  state={{ from: `/books/${bookId}` }}
                  className="inline-flex px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                >
                  Sign In to Review
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <span className="block text-sm font-medium text-[#1C1F1D] mb-1.5">Rating</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        aria-label={`Rate ${star} stars`}
                        className="p-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1B4D3E] rounded"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            star <= rating
                              ? 'fill-[#1B4D3E] text-[#1B4D3E]'
                              : 'text-[#D6CFC2] hover:text-[#1B4D3E]'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-[#5C615D] tabular-nums">{rating} / 5</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reviewComment"
                    className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                  >
                    Your thoughts on this book
                  </label>
                  <textarea
                    id="reviewComment"
                    required
                    minLength={5}
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What stood out about the writing, depth, or usefulness?"
                    className="w-full p-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-sm text-[#1C1F1D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={finishedReading}
                    onChange={(e) => setFinishedReading(e.target.checked)}
                    className="w-4 h-4 accent-[#1B4D3E]"
                  />
                  <span>I have read this book</span>
                </label>

                {reviewError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {reviewError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {reviewSubmitting ? 'Publishing...' : 'Publish Review'}
                </button>
              </form>
            )}
          </div>

          {/* Right: Reviews List */}
          <div className="lg:col-span-7 space-y-4">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center text-sm text-[#5C615D]">
                No reviews yet. Readers who have finished this book can share the first review.
              </div>
            ) : (
              reviews.map((rev) => (
                <article
                  key={rev.id}
                  className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C615D]">
                      <strong className="text-sm font-semibold text-[#1C1F1D]">
                        {rev.authorName}
                      </strong>
                      {rev.authorCity && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{rev.authorCity}</span>
                        </>
                      )}
                      {rev.finishedReading && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#1B4D3E]">Read this book</span>
                        </>
                      )}
                    </div>
                    <StarDisplay rating={rev.rating} />
                  </div>
                  <p className="text-sm text-[#1C1F1D]/90 leading-relaxed">{rev.comment}</p>
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Ask a Question */}
          <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">
                Ask about this book
              </h3>
              <p className="text-xs text-[#5C615D] mt-1">
                Ask about difficulty, chapters, language level, or edition details. Readers who have
                read the book can reply.
              </p>
            </div>

            {!isAuthenticated ? (
              <div className="space-y-3 text-sm text-[#5C615D]">
                <p>Sign in to ask a question or answer another reader&rsquo;s question.</p>
                <Link
                  to="/login"
                  state={{ from: `/books/${bookId}` }}
                  className="inline-flex px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                >
                  Sign In to Ask
                </Link>
              </div>
            ) : (
              <form onSubmit={handleQuestionSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="bookQuestionInput"
                    className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                  >
                    Your question
                  </label>
                  <textarea
                    id="bookQuestionInput"
                    required
                    minLength={5}
                    rows={3}
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="e.g. Does this edition include practice exercises or glossary notes?"
                    className="w-full p-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                  />
                </div>

                {questionError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {questionError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={questionSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {questionSubmitting ? 'Posting...' : 'Post Question'}
                </button>
              </form>
            )}
          </div>

          {/* Right: Questions & Reader Answers */}
          <div className="lg:col-span-7 space-y-4">
            {questions.length === 0 ? (
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center text-sm text-[#5C615D]">
                No questions asked yet. Have a question about {bookTitle}? Ask it on the left.
              </div>
            ) : (
              questions.map((q) => (
                <article
                  key={q.id}
                  className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 space-y-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-[#5C615D]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#1B4D3E]" />
                      <span>
                        Asked by <strong className="text-[#1C1F1D]">{q.authorName}</strong>
                      </span>
                    </div>
                    <p className="text-base font-medium text-[#1C1F1D]">{q.question}</p>
                  </div>

                  {q.answers.length > 0 && (
                    <div className="space-y-3 pl-4 border-t border-[#E5DFD3]/70 pt-3">
                      {q.answers.map((ans) => (
                        <div key={ans.id} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C615D]">
                            <strong className="text-[#1C1F1D]">{ans.authorName}</strong>
                            {ans.hasReadBook && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-[#1B4D3E]">
                                  Reader who read this book
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-[#1C1F1D]/90 leading-relaxed">{ans.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAuthenticated && (
                    <div className="pt-2 border-t border-[#E5DFD3]/70">
                      {answeringId === q.id ? (
                        <form
                          onSubmit={(e) => void handleAnswerSubmit(e, q.id)}
                          className="space-y-3 pt-1"
                        >
                          <textarea
                            required
                            minLength={3}
                            rows={2}
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Share your answer based on reading this book..."
                            className="w-full p-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                          />

                          <label className="flex items-center gap-2 text-xs text-[#1C1F1D] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasReadBook}
                              onChange={(e) => setHasReadBook(e.target.checked)}
                              className="w-4 h-4 accent-[#1B4D3E]"
                            />
                            <span>I have read this book</span>
                          </label>

                          {answerError && (
                            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              {answerError}
                            </p>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={answerSubmitting}
                              className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-xs font-semibold hover:bg-[#143A2F] disabled:opacity-60 cursor-pointer"
                            >
                              {answerSubmitting ? 'Posting...' : 'Post Answer'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAnsweringId(null);
                                setAnswerError(null);
                              }}
                              className="px-3 py-2 rounded-lg border border-[#E5DFD3] text-xs text-[#5C615D] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAnsweringId(q.id);
                            setAnswerText('');
                            setAnswerError(null);
                          }}
                          className="text-xs font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
                        >
                          Answer this question
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
