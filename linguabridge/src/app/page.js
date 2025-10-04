// FILE: src/app/page.jsx
"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";

// Dynamically load PDFViewer (client-side only)
const PDFViewer = dynamic(() => import("@/components/PDFViewer"), { ssr: false });

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function Home() {
  const [documentId, setDocumentId] = useState(null);
  const [filename, setFilename] = useState("");
  const [fileExt, setFileExt] = useState("pdf");
  const [nativeText, setNativeText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [viewLang, setViewLang] = useState("native");
  const [userDocuments, setUserDocuments] = useState([]);
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  // Function to fetch document metadata
  const fetchDocumentMetadata = async (docId) => {
    if (!docId || docId === 'undefined') {
      console.error("Invalid document ID:", docId);
      return null;
    }
    
    try {
      const response = await fetch(`${BACKEND}/metadata/${docId}`);
      if (response.ok) {
        const metadata = await response.json();
        setFileExt(metadata.fileExt || "pdf");
        setNativeText(metadata.nativeText || "");
        setTranslatedText(metadata.translatedText || "");
        return metadata;
      } else {
        console.error("Failed to fetch metadata:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
    return null;
  };

  // Function to fetch user's documents
  const fetchUserDocuments = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${BACKEND}/user/documents?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserDocuments(data.documents || []);
      } else {
        console.error("Failed to fetch user documents:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching user documents:", error);
    }
  };

  // Function to delete a user's document
  const deleteUserDocument = async (doc) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${BACKEND}/user/documents/${doc.document_id}?user_id=${user.id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // Refresh user documents list
        await fetchUserDocuments();
        
        // If the deleted document was currently selected, clear the view
        if (documentId === doc.document_id) {
          setDocumentId(null);
          setFilename("");
          setNativeText("");
          setTranslatedText("");
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error; // Re-throw to be handled by the Sidebar component
    }
  };

  // On mount, check if user is authenticated, else redirect to /login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // Load user documents when user is available
  useEffect(() => {
    if (user?.id) {
      fetchUserDocuments();
    }
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Checking authentication…
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0">
        <TopBar
          viewLang={viewLang}
          setViewLang={setViewLang}
          onUploadComplete={async (meta) => {
            const docId = meta.documentId || meta.id || meta.name;
            
            // Only proceed if we have a valid document ID
            if (docId && docId !== 'undefined') {
              setDocumentId(docId);
              setFilename(meta.filename || meta.name || "Document");
              setPageNumber(1);
              setZoom(1);
              
              // Fetch metadata including translated text
              await fetchDocumentMetadata(docId);
              
              // Refresh user documents list
              await fetchUserDocuments();
            } else {
              console.error("Upload completed but no valid document ID received:", meta);
            }
          }}
        />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden lg:flex w-[280px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--muted)]">
          <Sidebar 
            currentFileName={filename} 
            userDocuments={userDocuments}
            onDocumentSelect={async (doc) => {
              setDocumentId(doc.document_id);
              setFilename(doc.title);
              setPageNumber(1);
              setZoom(1);
              await fetchDocumentMetadata(doc.document_id);
            }}
            onDocumentDelete={deleteUserDocument}
          />
        </aside>
        <main className="flex-1 min-w-0">
          <PDFViewer
            documentId={documentId}
            filename={filename}
            fileExt={fileExt}
            nativeText={nativeText}
            translatedText={translatedText}
            viewLang={viewLang}
            setViewLang={setViewLang}
            pageNumber={pageNumber}
            setPageNumber={setPageNumber}
            numPages={numPages}
            setNumPages={setNumPages}
            zoom={zoom}
            setZoom={setZoom}
          />
        </main>
        <aside className="hidden lg:flex w-[360px] xl:w-[420px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--muted)] overflow-hidden">
          <ChatPanel documentId={documentId} />
        </aside>
      </div>
    </div>
  );
}
