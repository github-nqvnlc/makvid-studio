export const metadata = { title: "HyperFrames player spike" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, background: "#111", color: "#eee", fontFamily: "sans-serif" }}>{children}</body>
    </html>
  );
}
