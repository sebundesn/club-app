// frontend/app/layout.tsx

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
      </body>
    </html>
  )
}