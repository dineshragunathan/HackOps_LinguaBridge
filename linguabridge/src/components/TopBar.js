// FILE: src/components/TopBar.js
"use client";

import { useEffect, useState } from "react";
import { Upload, Plus, Moon, Sun, LogOut, User } from "lucide-react";
import UploadDialog from "@/components/UploadDialog";
import { useUser } from "@/contexts/UserContext";

export default function TopBar({ onUploadComplete, viewLang, setViewLang }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const { user, signOut } = useUser();

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  return (
    <header className="flex items-center justify-between gap-4 px-4 border-b border-[var(--border)] bg-[var(--muted)] h-[60px] overflow-hidden flex-shrink-0">
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-xl font-extrabold text-[var(--primary)] whitespace-nowrap">Linguabridge</div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--primary)] text-white hover:brightness-95 focus:outline-none whitespace-nowrap"
          aria-label="Upload PDF"
        >
          <Upload size={16} /> Upload PDF
        </button>
        
        {/* Language toggle buttons integrated into TopBar */}
        {viewLang !== undefined && (
          <div className="flex gap-1">
            <button
              onClick={() => setViewLang("native")}
              className={`px-2 py-1 rounded text-xs ${viewLang === "native" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              Native
            </button>
            <button
              onClick={() => setViewLang("english")}
              className={`px-2 py-1 rounded text-xs ${viewLang === "english" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              English
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="px-2 py-1 text-sm rounded-md bg-white/60 dark:bg-black/40 whitespace-nowrap">EN</div>
        
        {user && (
          <div className="flex items-center gap-2 px-2 py-1 text-sm rounded-md bg-white/60 dark:bg-black/40">
            <User size={14} />
            <span className="truncate max-w-24">{user.email}</span>
          </div>
        )}
        
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
        >
          <LogOut size={14} />
          Logout
        </button>
        
        <button
          onClick={() => setDark((d) => !d)}
          className="p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
          aria-pressed={dark}
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <UploadDialog
        open={open}
        onClose={() => setOpen(false)}
        onUploaded={(meta) => {
          setOpen(false);
          onUploadComplete && onUploadComplete(meta);
        }}
      />
    </header>
  );
}
