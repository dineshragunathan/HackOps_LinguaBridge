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

  const isAudioFile = ["mp3", "wav", "m4a", "flac", "ogg"].includes(fileExt.toLowerCase());
  const isImageFile = ["png", "jpg", "jpeg"].includes(fileExt.toLowerCase());

  return (
    <div className="h-full bg-white">
      <div className="h-full overflow-auto p-4">
        {/* Display uploaded image, PDF, or audio player */}
        {isImageFile ? (
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
        ) : isAudioFile ? (
          <div className="space-y-4">
            {/* Audio Player */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Original Audio</h3>
              <audio 
                controls 
                className="w-full"
                src={`${BACKEND}/audio/${documentId}`}
              >
                Your browser does not support the audio element.
              </audio>
              <p className="text-sm text-gray-600 mt-2">{filename}</p>
            </div>
            
            {/* Transcription Display */}
            <div className="bg-gray-100 p-4 rounded text-lg">
              <h3 className="text-lg font-semibold mb-3">
                {viewLang === "native" ? "Transcription" : "Translation"}
              </h3>
              <div className="whitespace-pre-wrap">
                {viewLang === "native" 
                  ? (nativeText || "(No transcription available)")
                  : (translatedText || "(No translation available)")
                }
              </div>
            </div>
          </div>
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
