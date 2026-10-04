// frontend/app/layout.tsx

import "./globals.css";
import Header from "../components/Header";
import { ToastProvider } from "../components/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <ToastProvider>
          <Header />
          <main>
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  )
}
