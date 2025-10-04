// FILE: src/components/Sidebar.js
"use client";

import { Plus, FileText, Calendar, Trash2 } from "lucide-react";
import { useState } from "react";

export default function Sidebar({ currentFileName, userDocuments = [], onDocumentSelect, onDocumentDelete }) {
  const [deletingDoc, setDeletingDoc] = useState(null);
  
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleDelete = async (doc, e) => {
    e.stopPropagation(); // Prevent document selection when clicking delete
    
    if (!confirm(`Are you sure you want to delete "${doc.title}"?\n\nThis will permanently delete:\n• The document file\n• All translations\n• All chat history\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setDeletingDoc(doc.document_id);
    try {
      await onDocumentDelete?.(doc);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete document. Please try again.");
    } finally {
      setDeletingDoc(null);
    }
  };

  return (
    <nav className="p-4 flex flex-col h-full" role="navigation" aria-label="Sidebar">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fg-muted)] mb-3">My Documents</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg">
          {userDocuments.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic px-3 py-4 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              No documents yet. Upload your first document to get started!
            </div>
          ) : (
            userDocuments.map((doc) => (
              <div
                key={doc.document_id}
                className={`w-full px-3 py-2 rounded-lg transition-all duration-200 border transform hover:scale-[1.02] group ${
                  currentFileName === doc.title
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => onDocumentSelect?.(doc)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-start gap-2">
                      <FileText size={16} className={`mt-0.5 flex-shrink-0 ${
                        currentFileName === doc.title ? "text-blue-100" : "text-gray-600 dark:text-gray-400"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium break-words ${
                          currentFileName === doc.title ? "text-white" : "text-gray-900 dark:text-gray-100"
                        }`}>{doc.title}</div>
                        <div className={`text-xs flex items-center gap-1 ${
                          currentFileName === doc.title ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                        }`}>
                          <Calendar size={12} />
                          {formatDate(doc.created_at)}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={(e) => handleDelete(doc, e)}
                    disabled={deletingDoc === doc.document_id}
                    className={`p-1 rounded-md transition-colors ${
                      currentFileName === doc.title
                        ? "hover:bg-blue-600 text-blue-100 hover:text-white"
                        : "hover:bg-red-100 dark:hover:bg-red-900 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    } ${deletingDoc === doc.document_id ? "opacity-50 cursor-not-allowed" : ""}`}
                    title="Delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fg-muted)] mb-3">Tools</h3>
        <ul className="space-y-2 text-sm">
          <li className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-white/5">AI Summarizer</li>
          <li className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-white/5">Export Translation</li>
          <li className="px-2 py-1 rounded-md hover:bg-white/50 dark:hover:bg-white/5">Billingual View</li>
        </ul>
      </div>

      <div className="mt-auto p-3 bg-white/60 dark:bg-black/20 rounded-md text-center">
        <div className="text-sm font-medium mb-2">Need help?</div>
        <div className="text-xs text-[var(--fg-muted)]">
          Upload PDFs or images to start translating and chatting
        </div>
      </div>
    </nav>
  );
}
