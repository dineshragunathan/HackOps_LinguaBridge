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
  isSwitchingDocument = false,
}) {
  // Create a unique key to force re-render when document changes
  const componentKey = `${documentId}-${viewLang}`;
  if (!documentId) {
    return <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">No document selected</div>;
  }

  // Check if this is a temporary document (still processing)
  const isTemporaryDocument = documentId.startsWith('temp-');
  
  const isAudioFile = ["mp3", "wav", "m4a", "flac", "ogg"].includes(fileExt.toLowerCase());
  const isImageFile = ["png", "jpg", "jpeg"].includes(fileExt.toLowerCase());

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col" key={componentKey}>
      <div className="flex-1 overflow-hidden p-4">
        {/* Show loading state when switching documents */}
        {isSwitchingDocument ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">Loading document...</p>
            </div>
          </div>
        ) : isTemporaryDocument ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Processing Document
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                {filename}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Please wait while we process your file...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Display uploaded image, PDF, or audio player */}
            {isImageFile ? (
              viewLang === "native" ? (
                <div className="h-full flex items-center justify-center">
                  <img
                    src={`${BACKEND}/file/${documentId}`}
                    alt={filename}
                    className="max-w-full max-h-full object-contain border rounded"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                  />
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <div className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 p-4 rounded text-lg text-gray-900 dark:text-gray-100">
                    {translatedText || "(No translation available)"}
                  </div>
                </div>
              )
            ) : isAudioFile ? (
              <div className="h-full overflow-y-auto space-y-4">
                {/* Audio Player */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Original Audio</h3>
                  <audio 
                    controls 
                    className="w-full"
                    src={`${BACKEND}/audio/${documentId}`}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{filename}</p>
                </div>
                
                {/* Transcription Display */}
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-lg">
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    {viewLang === "native" ? "Transcription" : "Translation"}
                  </h3>
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                    {isTemporaryDocument ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                        <span className="text-gray-600 dark:text-gray-300">Processing...</span>
                      </div>
                    ) : (
                      viewLang === "native" 
                        ? (nativeText || "(No transcription available)")
                        : (translatedText || "(No translation available)")
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* PDF files - show original PDF for native, text for English */
              viewLang === "native" ? (
                /* Native view: Show original PDF file */
                <div className="h-full">
                  <iframe
                    src={`${BACKEND}/file/${documentId}?lang=native`}
                    title={filename}
                    className="w-full h-full border rounded"
                    style={{ minHeight: '600px' }}
                  />
                </div>
              ) : (
                /* English view: Show translated text */
                <div className="h-full overflow-y-auto space-y-4">
                  {/* PDF Info */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Document: {filename}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">PDF Document - Translated Text</p>
                  </div>
                  
                  {/* Text Content Display */}
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-lg">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Translation</h3>
                    <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                      {isTemporaryDocument ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                          <span className="text-gray-600 dark:text-gray-300">Processing...</span>
                        </div>
                      ) : (
                        translatedText || "(No translation available)"
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
