// frontend/app/layout.tsx

import "./globals.css";
import CheckoutButton from "./utils/CheckoutButton";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        {/* ここにページの中身が流し込まれます */}
        {children}
        <CheckoutButton />
      </body>
    </html>
  )
}