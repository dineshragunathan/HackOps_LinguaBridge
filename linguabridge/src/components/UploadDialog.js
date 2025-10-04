"use client";

import { useRef, useState } from "react";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function UploadDialog({ open, onClose, onUploaded, onUploadStart }) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragover, setDragover] = useState({
    isDragging: false,
    isValid: false
  });
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  if (!open) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = selectedFile || inputRef.current?.files?.[0];
    if (!file) return alert("Pick a file first");
    
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        alert("You must be logged in to upload files.");
        return;
      }

      // Close dialog immediately and start processing in background
      const userId = session.user.id;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("user_id", userId);

      // Close dialog and show processing state
      setSelectedFile(null);
      onClose();
      
      // Notify parent that upload is starting
      onUploadStart && onUploadStart(file);
      
      // Start upload in background
      const res = await fetch(`${BACKEND}/upload`, { method: "POST", body: fd });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Upload failed:", res.status, errorData);
        alert(`Upload failed: ${errorData.error || res.statusText}`);
        return;
      }
      
      const json = await res.json();
      console.log("Upload response:", json);
      
      if (!json.documentId) {
        console.error("No document ID in response:", json);
        alert("Upload completed but no document ID received");
        return;
      }
      
      // Notify parent component that upload completed
      onUploaded && onUploaded(json);
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Upload failed: ${err.message}`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragover({ isDragging: true, isValid: true });
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only leave if actually leaving the dropzone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragover({ isDragging: false, isValid: false });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragover({ isDragging: false, isValid: false });
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      inputRef.current.files = files;
      setSelectedFile(files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[520px] max-w-[90vw] mx-4"> 
        <form 
          onSubmit={handleSubmit} 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 rounded-xl bg-white dark:bg-[var(--muted)] shadow-xl border-2 transition-all duration-200 ${
            dragover.isDragging 
              ? 'border-[var(--primary)] bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <h3 className="text-xl font-semibold mb-3 text-center">Upload Document</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-6 text-center">
            Upload PDF, image, or audio files (Nepali/Sinhala). We&apos;ll OCR/transcribe and translate them automatically.
          </p>
          
          {/* Drop zone area */}
          <div className={`relative mb-6 p-8 border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer ${
            dragover.isDragging 
              ? 'border-[var(--primary)] bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}>
            <input 
              ref={inputRef} 
              type="file" 
              accept=".pdf,image/*,audio/*,.mp3,.wav,.m4a,.flac,.ogg" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={handleFileChange}
            />
            <div className="text-center">
              <div className="text-4xl mb-3">
                {dragover.isDragging ? '📁' : '📎'}
              </div>
              <p className="text-sm text-[var(--fg-muted)]">
                {dragover.isDragging 
                  ? 'Drop your file here' 
                  : 'Click to browse or drag & drop files here'
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, JPEG, MP3, WAV, M4A, FLAC, OGG supported</p>
            </div>
          </div>
          
          {/* File name display */}
          {selectedFile && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 text-white rounded-lg">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-xs text-gray-400 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400 mt-1">Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
          
          <div className="flex justify-end gap-3"        >
          <button 
            onClick={() => {
              setSelectedFile(null);
              onClose();
            }} 
            type="button" 
            className="px-6 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
            <button 
              type="submit" 
              className="px-6 py-2 rounded-md bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-medium transition-colors flex items-center gap-2" 
            >
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
