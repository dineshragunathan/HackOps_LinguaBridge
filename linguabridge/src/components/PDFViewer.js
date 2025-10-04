"use client";

import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function PDFViewer({
  documentId,
  filename,
  fileExt = "pdf",
  nativeText = "",
  translatedText = "",
  viewLang = "native",
  setViewLang,
}) {
  if (!documentId) {
    return <div className="flex items-center justify-center h-full">No document selected</div>;
  }

  return (
    <div className="h-full bg-white">
      <div className="h-full overflow-auto p-4">
        {/* Display uploaded image or PDF for native and translated text for English */}
        {["png", "jpg", "jpeg"].includes(fileExt.toLowerCase()) ? (
          viewLang === "native" ? (
            <img
              src={`${BACKEND}/file/${documentId}`}
              alt={filename}
              className="max-w-full border rounded"
            />
          ) : (
            <div className="whitespace-pre-wrap bg-gray-100 p-4 rounded text-lg">
              {translatedText || "(No translation available)"}
            </div>
          )
        ) : (
          <iframe
            src={`${BACKEND}/file/${documentId}?lang=${viewLang}`}
            title={filename}
            className="w-full h-full border rounded"
          />
        )}
      </div>
    </div>
  );
}
