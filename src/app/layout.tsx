import type { ReactNode } from "react";

// The public landing page ("/") is served by app/route.ts as a complete HTML document.
// This root layout is only used by the admin (CMS) pages.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="cms">{children}</body>
    </html>
  );
}
