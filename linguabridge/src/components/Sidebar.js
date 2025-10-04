// FILE: src/components/Sidebar.js
"use client";

import { Plus, FileText, Calendar, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function Sidebar({ currentFileName, userDocuments = [], processingDocuments = new Set(), onDocumentSelect, onDocumentDelete }) {
  const [deletingDoc, setDeletingDoc] = useState(null);
  
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Check if a document is currently processing
  const isProcessing = (docId) => {
    return processingDocuments.has(docId);
  };

  // Get all documents including temporary processing ones
  const allDocuments = [...userDocuments];
  
  // Add temporary processing documents that aren't in userDocuments yet
  processingDocuments.forEach(tempId => {
    if (tempId.startsWith('temp-') && !userDocuments.some(doc => doc.document_id === tempId)) {
      allDocuments.push({
        document_id: tempId,
        title: currentFileName || "Processing...",
        created_at: new Date().toISOString(),
        is_temp: true
      });
    }
  });

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
    <nav className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full" role="navigation" aria-label="Sidebar">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your Documents</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Manage your uploaded files and translations</p>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allDocuments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No documents yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Upload your first document to get started</p>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="font-medium mb-1">Supported formats:</p>
              <p>PDF, PNG, JPG, JPEG, MP3, WAV, M4A, FLAC, OGG</p>
            </div>
          </div>
        ) : (
          allDocuments.map((doc, index) => (
            <div
              key={doc.document_id}
              onClick={() => onDocumentSelect?.(doc)}
              className={`group relative p-4 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                currentFileName === doc.title
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium break-words hyphens-auto leading-tight flex items-center gap-2 ${
                    currentFileName === doc.title ? "text-white" : "text-gray-900 dark:text-gray-100"
                  }`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    <FileText size={14} className="flex-shrink-0" />
                    {doc.title}
                    {isProcessing(doc.document_id) && (
                      <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className={`text-xs flex items-center gap-1 mt-1 ${
                    currentFileName === doc.title ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                  }`}>
                    <Calendar size={12} />
                    {isProcessing(doc.document_id) ? "Processing..." : formatDate(doc.created_at)}
                  </div>
                </div>
                
                <button
                  onClick={(e) => handleDelete(doc, e)}
                  disabled={deletingDoc === doc.document_id || doc.is_temp}
                  className={`p-2 rounded-md transition-colors ${
                    currentFileName === doc.title
                      ? "hover:bg-blue-700 text-blue-100 hover:text-white"
                      : "hover:bg-red-100 text-gray-400 hover:text-red-600"
                  } ${deletingDoc === doc.document_id || doc.is_temp ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={doc.is_temp ? "Cannot delete while processing" : "Delete document"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              {/* Processing indicator */}
              {isProcessing(doc.document_id) && (
                <div className="absolute inset-0 rounded-lg bg-blue-500/10 animate-pulse pointer-events-none" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Help Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Need help?</div>
          <div className="text-xs text-gray-600 dark:text-gray-300">
            Upload PDFs or images to start translating and chatting
          </div>
        </div>
      </div>
    </nav>
  );
}
