// FILE: src/app/layout.js
import "../app/globals.css";
import { UserProvider } from "@/contexts/UserContext";

export const metadata = {
  title: "Linguabridge",
  description: "ChatPDF-style interface for translations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-[var(--bg)] text-[var(--fg)]">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
