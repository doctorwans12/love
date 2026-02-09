import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Do You Talk to the Person You Like?",
  description: "A dating communication style test with practical advice."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="bg-gradient-to-br from-white via-soft to-white">
          {children}
        </main>
      </body>
    </html>
  );
}
