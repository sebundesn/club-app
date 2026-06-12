// frontend/app/layout.tsx

import "./globals.css";
import Header from "../components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Header />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}