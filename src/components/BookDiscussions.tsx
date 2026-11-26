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

function calcProgressPercent(currentPage?: number, totalPages?: number): number | null {
  if (!currentPage || !totalPages || totalPages < currentPage || totalPages <= 0) {
    return null;
  }
  return Math.min(100, Math.max(1, Math.round((currentPage / totalPages) * 100)));
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

export function BookDiscussions({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const { user, isAuthenticated } = useAuth();
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
  const [currentPageInput, setCurrentPageInput] = useState('');
  const [totalPagesInput, setTotalPagesInput] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Inline review progress edit state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [editFinishedReading, setEditFinishedReading] = useState(false);
  const [editCurrentPage, setEditCurrentPage] = useState('');
  const [editTotalPages, setEditTotalPages] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
      const parsedCurrent = parseOptionalInt(currentPageInput);
      const parsedTotal = parseOptionalInt(totalPagesInput);
      const data = await discussionsApi.addReview(bookId, {
        rating,
        comment,
        finishedReading,
        ...(finishedReading ? {} : { currentPage: parsedCurrent }),
        ...(parsedTotal !== null ? { totalPages: parsedTotal } : {}),
      });
      const nextReviews = [data.review, ...reviews];
      setReviews(nextReviews);
      const avg =
        nextReviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, nextReviews.length);
      setAverageRating(Number(avg.toFixed(1)));
      setComment('');
      setRating(5);
      setFinishedReading(true);
      setCurrentPageInput('');
      setTotalPagesInput('');
    } catch (err) {
      setReviewError(getErrorMessage(err, 'Failed to submit review.'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startEditingReview = (rev: BookReview) => {
    setEditingReviewId(rev.id);
    setEditRating(rev.rating);
    setEditComment(rev.comment);
    setEditFinishedReading(rev.finishedReading);
    setEditCurrentPage(rev.currentPage ? String(rev.currentPage) : '');
    setEditTotalPages(rev.totalPages ? String(rev.totalPages) : '');
    setEditError(null);
  };

  const handleEditReviewSubmit = async (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError(null);
    try {
      const parsedCurrent = parseOptionalInt(editCurrentPage);
      const parsedTotal = parseOptionalInt(editTotalPages);
      const data = await discussionsApi.updateReview(bookId, reviewId, {
        rating: editRating,
        comment: editComment,
        finishedReading: editFinishedReading,
        ...(editFinishedReading ? {} : { currentPage: parsedCurrent }),
        ...(parsedTotal !== null ? { totalPages: parsedTotal } : {}),
      });
      const nextReviews = reviews.map((r) => (r.id === reviewId ? data.review : r));
      setReviews(nextReviews);
      const avg =
        nextReviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, nextReviews.length);
      setAverageRating(Number(avg.toFixed(1)));
      setEditingReviewId(null);
    } catch (err) {
      setEditError(getErrorMessage(err, 'Failed to update review progress.'));
    } finally {
      setEditSubmitting(false);
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
      const data = await discussionsApi.addAnswer(bookId, questionId, {
        body: answerText,
        hasReadBook,
      });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, answers: [...q.answers, data.answer] } : q,
        ),
      );
      setAnsweringId(null);
      setAnswerText('');
    } catch (err) {
      setAnswerError(getErrorMessage(err, 'Failed to post answer.'));
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const parsedFormCurrent = parseOptionalInt(currentPageInput);
  const parsedFormTotal = parseOptionalInt(totalPagesInput);
  const formPct =
    !finishedReading && parsedFormCurrent && parsedFormTotal && parsedFormTotal >= parsedFormCurrent
      ? calcProgressPercent(parsedFormCurrent, parsedFormTotal)
      : null;
  const currentlyReadingCount = reviews.filter((r) => !r.finishedReading && r.currentPage).length;

  return (
    <section className="mt-14 pt-10 border-t border-[#E5DFD3] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D]">
            Reader reviews &amp; Q&amp;A
          </h2>
          <p className="text-sm text-[#5C615D] mt-1">
            Read impressions and current reading progress for {bookTitle}, or ask a question for
            fellow readers.
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
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-[#E5DFD3]">
              <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">Write a review</h3>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#5C615D] tabular-nums">
                  <span className="text-sm font-semibold text-[#1B4D3E]">
                    {averageRating} / 5 avg
                  </span>
                  {currentlyReadingCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{currentlyReadingCount} reading now</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="space-y-3 text-sm text-[#5C615D]">
                <p>Sign in to share your rating, reading progress, and review of this book.</p>
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
                  <span className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                    Reading status
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFinishedReading(true)}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        finishedReading
                          ? 'bg-[#FFFFFF] text-[#1C1F1D] shadow-xs'
                          : 'text-[#5C615D] hover:text-[#1C1F1D]'
                      }`}
                    >
                      Finished reading
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinishedReading(false)}
                      className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        !finishedReading
                          ? 'bg-[#FFFFFF] text-[#1B4D3E] shadow-xs'
                          : 'text-[#5C615D] hover:text-[#1C1F1D]'
                      }`}
                    >
                      Currently reading
                    </button>
                  </div>
                </div>

                {!finishedReading && (
                  <div className="space-y-2.5 pt-0.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="reviewCurrentPage"
                          className="block text-xs font-medium text-[#1C1F1D] mb-1"
                        >
                          Current page
                        </label>
                        <input
                          id="reviewCurrentPage"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20000}
                          required={!finishedReading}
                          value={currentPageInput}
                          onChange={(e) => setCurrentPageInput(e.target.value)}
                          placeholder="e.g. 142"
                          className="w-full h-10 px-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="reviewTotalPages"
                          className="block text-xs font-medium text-[#5C615D] mb-1"
                        >
                          Total pages (optional)
                        </label>
                        <input
                          id="reviewTotalPages"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20000}
                          value={totalPagesInput}
                          onChange={(e) => setTotalPagesInput(e.target.value)}
                          placeholder="e.g. 320"
                          className="w-full h-10 px-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                        />
                      </div>
                    </div>

                    {parsedFormCurrent !== null && parsedFormCurrent >= 1 && (
                      <div className="space-y-1.5">
                        {parsedFormTotal !== null && parsedFormTotal < parsedFormCurrent ? (
                          <p className="text-xs text-red-700 tabular-nums">
                            Total pages should be at least {parsedFormCurrent}.
                          </p>
                        ) : formPct !== null ? (
                          <>
                            <div className="flex items-center justify-between text-xs text-[#5C615D] tabular-nums">
                              <span>
                                Page {parsedFormCurrent} of {parsedFormTotal}
                              </span>
                              <span className="font-semibold text-[#1B4D3E]">{formPct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#F3EFE6] overflow-hidden">
                              <div
                                className="h-full bg-[#1B4D3E] rounded-full transition-all"
                                style={{ width: `${formPct}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#5C615D] tabular-nums">
                            Sharing progress at page {parsedFormCurrent}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                    {finishedReading ? 'Your thoughts on this book' : 'Your thoughts so far'}
                  </label>
                  <textarea
                    id="reviewComment"
                    required
                    minLength={5}
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      finishedReading
                        ? 'What stood out about the writing, depth, or usefulness?'
                        : 'Share your impressions so far and what keeps you reading...'
                    }
                    className="w-full p-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                  />
                </div>

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
                  {reviewSubmitting
                    ? 'Publishing...'
                    : finishedReading
                      ? 'Publish Review'
                      : 'Share Reading Progress'}
                </button>
              </form>
            )}
          </div>

          {/* Right: Reviews List */}
          <div className="lg:col-span-7 space-y-4">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center text-sm text-[#5C615D]">
                No reviews yet. Share your thoughts or track your current page on this book.
              </div>
            ) : (
              reviews.map((rev) => {
                const isOwnReview = Boolean(user && user.id === rev.authorId);
                const isEditing = editingReviewId === rev.id;
                const progressPct = calcProgressPercent(rev.currentPage, rev.totalPages);

                return (
                  <article
                    key={rev.id}
                    className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 space-y-3"
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
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#1B4D3E]">
                          {rev.finishedReading ? 'Read this book' : 'Currently reading'}
                        </span>
                      </div>
                      <StarDisplay rating={rev.rating} />
                    </div>

                    {!isEditing ? (
                      <>
                        {!rev.finishedReading && rev.currentPage && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C615D] tabular-nums">
                              <span className="font-medium text-[#1C1F1D]">
                                {rev.totalPages
                                  ? `Page ${rev.currentPage.toLocaleString()} of ${rev.totalPages.toLocaleString()}`
                                  : `Currently on page ${rev.currentPage.toLocaleString()}`}
                              </span>
                              {progressPct !== null && (
                                <span className="font-semibold text-[#1B4D3E]">
                                  {progressPct}% complete
                                </span>
                              )}
                            </div>
                            {progressPct !== null && (
                              <div className="h-1.5 w-full rounded-full bg-[#F3EFE6] overflow-hidden">
                                <div
                                  className="h-full bg-[#1B4D3E] rounded-full"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-sm text-[#1C1F1D]/90 leading-relaxed">{rev.comment}</p>

                        {isOwnReview && (
                          <div className="pt-2 border-t border-[#E5DFD3]/70 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => startEditingReview(rev)}
                              className="text-xs font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
                            >
                              {rev.finishedReading ? 'Edit review' : 'Update current page'}
                            </button>
                            {rev.updatedAt && (
                              <span className="text-xs text-[#5C615D]">Progress updated</span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <form
                        onSubmit={(e) => void handleEditReviewSubmit(e, rev.id)}
                        className="space-y-3 pt-2 border-t border-[#E5DFD3]/70"
                      >
                        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg">
                          <button
                            type="button"
                            onClick={() => setEditFinishedReading(false)}
                            className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              !editFinishedReading
                                ? 'bg-[#FFFFFF] text-[#1B4D3E] shadow-xs'
                                : 'text-[#5C615D] hover:text-[#1C1F1D]'
                            }`}
                          >
                            Currently reading
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditFinishedReading(true)}
                            className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              editFinishedReading
                                ? 'bg-[#FFFFFF] text-[#1C1F1D] shadow-xs'
                                : 'text-[#5C615D] hover:text-[#1C1F1D]'
                            }`}
                          >
                            Finished reading
                          </button>
                        </div>

                        {!editFinishedReading && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor={`editPage-${rev.id}`}
                                className="block text-xs font-medium text-[#1C1F1D] mb-1"
                              >
                                Current page
                              </label>
                              <input
                                id={`editPage-${rev.id}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={20000}
                                required={!editFinishedReading}
                                value={editCurrentPage}
                                onChange={(e) => setEditCurrentPage(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`editTotal-${rev.id}`}
                                className="block text-xs font-medium text-[#5C615D] mb-1"
                              >
                                Total pages (optional)
                              </label>
                              <input
                                id={`editTotal-${rev.id}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={20000}
                                value={editTotalPages}
                                onChange={(e) => setEditTotalPages(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setEditRating(star)}
                              aria-label={`Rate ${star} stars`}
                              className="p-0.5 cursor-pointer rounded"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= editRating
                                    ? 'fill-[#1B4D3E] text-[#1B4D3E]'
                                    : 'text-[#D6CFC2]'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="ml-2 text-xs text-[#5C615D] tabular-nums">
                            {editRating} / 5
                          </span>
                        </div>

                        <textarea
                          required
                          minLength={5}
                          rows={2}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          className="w-full p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                        />

                        {editError && (
                          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {editError}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={editSubmitting}
                            className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-xs font-semibold hover:bg-[#143A2F] disabled:opacity-60 cursor-pointer"
                          >
                            {editSubmitting ? 'Saving...' : 'Save Progress'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReviewId(null);
                              setEditError(null);
                            }}
                            className="px-3 py-2 rounded-lg border border-[#E5DFD3] text-xs text-[#5C615D] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })
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
