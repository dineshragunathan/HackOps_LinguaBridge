"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function FeedbackDialog({ open, onClose }) {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("general");
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedbackText.trim() || feedbackText.trim().length < 10) {
      alert("Please provide feedback with at least 10 characters");
      return;
    }

    setLoading(true);
    
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        alert("You must be logged in to submit feedback.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: session.user.id,
          feedback_text: feedbackText.trim(),
          feedback_type: feedbackType,
          rating: rating,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        alert(result.error || "Failed to submit feedback");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFeedbackText("");
    setFeedbackType("general");
    setRating(null);
    setSubmitted(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[500px] max-w-[90vw] mx-4">
        <div className="p-6 rounded-xl bg-white dark:bg-[var(--muted)] shadow-xl border border-gray-200 dark:border-gray-700">
          {submitted ? (
            <div className="text-center">
              <div className="text-green-500 text-6xl mb-4">✓</div>
              <h3 className="text-xl font-semibold mb-2 text-green-600">Thank You!</h3>
              <p className="text-gray-600 dark:text-gray-800">
                Your feedback has been submitted successfully.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-semibold mb-4 text-center">Send Feedback</h3>
              <p className="text-sm text-gray-400 dark:text-gray-800 mb-6 text-center">
                Help us improve LinguaBridge by sharing your thoughts and suggestions.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Feedback Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Feedback Type</label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="general">General Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium mb-2">Rating (Optional)</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(rating === star ? null : star)}
                        className={`text-2xl transition-colors ${
                          rating && star <= rating
                            ? "text-yellow-400"
                            : "text-gray-300 hover:text-yellow-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Text */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Your Feedback <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Please describe your feedback, suggestions, or report any issues you've encountered..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={5}
                    required
                    minLength={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {feedbackText.length}/10 minimum characters
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || feedbackText.trim().length < 10}
                    className="flex-1 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
