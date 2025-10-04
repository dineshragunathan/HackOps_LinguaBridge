// FILE: components/ViewerPane.jsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function ViewerPane({ asset }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPage] = useState(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setPage(1);
    setNumPages(null);
  }, [asset?.url]);

  return (
    <section className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <h2 className="truncate pr-2 text-sm font-medium">{asset?.name ?? "No document"}</h2>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)]">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full items-center justify-center p-6">
          {!asset && <EmptyState />}
          {asset?.type === "pdf" && (
            <Document file={asset.url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
              <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false} renderTextLayer={false} />
            </Document>
          )}
          {asset?.type === "image" && (
            <img src={asset.url} alt={asset.name} className="max-h-[80vh] max-w-[90%] rounded-lg shadow" />
          )}
          {asset?.type === "audio" && (
            <audio src={asset.url} controls className="w-full max-w-xl" />
          )}
          {asset?.type === "text" && (
            <div className="max-w-3xl whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
              {asset.text}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-center gap-2 border-t border-[var(--border)] bg-[var(--muted)] px-3 py-2">
        <IconButton onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))} ariaLabel="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={() => setScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))} ariaLabel="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </IconButton>

        <div className="mx-3 text-sm tabular-nums">
          {numPages ? `${pageNumber} of ${numPages}` : asset?.type === "pdf" ? "—" : ""}
        </div>

        <IconButton onClick={() => setPage((p) => Math.max(1, p - 1))} ariaLabel="Prev">
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={() => setPage((p) => Math.min(numPages ?? 1, p + 1))} ariaLabel="Next">
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </section>
  );
}

function IconButton({ children, onClick, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--hover)]"
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-6 text-sm text-[var(--fg-muted)]">
      Upload an image, PDF, audio, or paste text to start a translation session. 
    </div>
  );
}
