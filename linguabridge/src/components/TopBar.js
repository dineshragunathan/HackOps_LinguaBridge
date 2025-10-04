// FILE: src/components/TopBar.js
"use client";

import { useState } from "react";
import { Upload, Plus, LogOut, User, MessageSquare, Download } from "lucide-react";
import UploadDialog from "@/components/UploadDialog";
import FeedbackDialog from "@/components/FeedbackDialog";
import { useUser } from "@/contexts/UserContext";
import jsPDF from "jspdf";

export default function TopBar({ onUploadComplete, onUploadStart, viewLang, setViewLang, documentId, translatedText }) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { user, signOut } = useUser();

  const handleDownloadPDF = () => {
    if (!translatedText || !translatedText.trim()) {
      alert("No translation available to download");
      return;
    }

    try {
      // Create new PDF document
      const pdf = new jsPDF();
      
      // Set font and size
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      
      // Get page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (2 * margin);
      
      // Split text into lines that fit the page width
      const lines = pdf.splitTextToSize(translatedText, maxWidth);
      
      let yPosition = margin;
      const lineHeight = 7;
      
      // Add text line by line
      for (let i = 0; i < lines.length; i++) {
        // Check if we need a new page
        if (yPosition + lineHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        
        pdf.text(lines[i], margin, yPosition);
        yPosition += lineHeight;
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `translation_${timestamp}.pdf`;
      
      // Download the PDF
      pdf.save(filename);
      
      console.log("[Frontend PDF] Generated PDF with", lines.length, "lines");
      console.log("[Frontend PDF] Text length:", translatedText.length);
      
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Error generating PDF");
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-[60px] overflow-hidden flex-shrink-0">
      <div className="flex items-center gap-6 shrink-0">
        <div className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
          LinguaBridge
        </div>
        
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
          aria-label="Upload PDF"
        >
          <Upload size={16} /> Upload File
        </button>
        
        {/* Language toggle buttons integrated into TopBar */}
        {viewLang !== undefined && (
          <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => setViewLang("native")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewLang === "native" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Native
            </button>
            <button
              onClick={() => setViewLang("english")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewLang === "english" 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              English
            </button>
          </div>
        )}

        {/* Download PDF Button */}
        {translatedText && viewLang === "english" && (
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors whitespace-nowrap"
            title="Download translation as PDF"
          >
            <Download size={16} />
            Download PDF
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          EN
        </div>
        
        {/* Feedback Button */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors whitespace-nowrap"
          title="Send Feedback"
        >
          <MessageSquare size={14} />
          Feedback
        </button>
        
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800">
            <User size={14} className="text-gray-600 dark:text-gray-300" />
            <span className="truncate max-w-24 font-medium text-gray-700 dark:text-gray-200">{user.email}</span>
          </div>
        )}
        
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <UploadDialog
        open={open}
        onClose={() => setOpen(false)}
        onUploadStart={onUploadStart}
        onUploaded={(meta) => {
          setOpen(false);
          onUploadComplete && onUploadComplete(meta);
        }}
      />
      
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </header>
  );
}
