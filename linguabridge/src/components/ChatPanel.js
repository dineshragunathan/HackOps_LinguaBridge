"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { useUser } from "@/contexts/UserContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ChatPanel({ documentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { user } = useUser();
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  // Load chat history when document changes
  const loadChatHistory = async () => {
    if (!documentId || !user?.id) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BACKEND}/user/chat/${documentId}?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.messages?.map(msg => ({
          id: msg.id || Date.now() + Math.random(),
          role: msg.role,
          content: msg.content,
        })) || [];
        setMessages(formattedMessages);
      } else {
        console.error("Failed to load chat history:", response.statusText);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Load chat history when documentId or user changes
  useEffect(() => {
    loadChatHistory();
  }, [documentId, user?.id]);

  useEffect(() => {
    // Only scroll if there are messages and avoid affecting the entire page
    if (messages.length > 0 && messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.parentElement;
      if (chatContainer) {
        // Use a small delay to ensure the DOM has updated
        setTimeout(() => {
          chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: "smooth"
          });
        }, 100);
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!documentId) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 2, 
        role: "assistant", 
        content: "Please upload a document first to start chatting about it." 
      }]);
      return;
    }

    const msg = input;
    const userMessageId = Date.now();
    const loadingId = Date.now() + 1;
    
    // Add both user message and loading message in a single state update to prevent layout shifts
    setMessages(prev => [...prev, 
      { id: userMessageId, role: "user", content: msg },
      { id: loadingId, role: "assistant", content: "Thinking..." }
    ]);
    setInput("");

    try {
      if (!user?.id) {
        setMessages(prev => prev.map(m => 
          m.id === loadingId 
            ? { ...m, content: "Please log in to use the chat feature." }
            : m
        ));
        return;
      }

      const userId = user.id;

      const res = await fetch(`${BACKEND}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, userId, message: msg }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        // Replace loading message with actual response
        setMessages(prev => prev.map(m => 
          m.id === loadingId 
            ? { ...m, content: data.reply }
            : m
        ));
      } else {
        console.error("Chat error:", data);
        setMessages(prev => prev.map(m => 
          m.id === loadingId 
            ? { ...m, content: data.error || "Sorry, I'm having trouble processing your request. Please try again." }
            : m
        ));
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      setMessages(prev => prev.map(m => 
        m.id === loadingId 
          ? { ...m, content: "Sorry, I'm unable to process your request right now. Please check your connection and try again." }
          : m
      ));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900 min-h-0 transition-none transform-none">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth min-w-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <div className="text-lg font-medium mb-2">💬 Chat with your document</div>
            <div className="text-sm">
              {documentId 
                ? "Ask questions about the uploaded document and get AI-powered answers!" 
                : "Upload a document first to start chatting about its content."
              }
            </div>
          </div>
        )}
        
        {loading && messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            Loading chat history...
          </div>
        )}
        
        {!loading && messages.length === 0 && documentId && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            No previous chat history. Start a conversation!
          </div>
        )}
        
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`max-w-[75%] px-4 py-2 rounded-lg break-words min-h-[44px] flex items-center transition-none ${msg.role === "assistant"
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 self-start"
                : "bg-blue-600 hover:bg-indigo-700 text-white self-end"
              }`}
          >
            {msg.content}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex gap-2 bg-white dark:bg-gray-900 min-h-[60px]">
        <input
          type="text"
          placeholder={documentId ? "Ask any question about the document…" : "Upload a document first..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault(); // Prevent default form submission behavior
              handleSend();
            }
          }}
          disabled={!documentId}
          className={`flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            !documentId ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !documentId}
          className={`p-2 rounded-md text-white ${
            !input.trim() || !documentId 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
