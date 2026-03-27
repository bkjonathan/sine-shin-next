import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shop Manager",
  description: "Internal shop management system",
};

// Inline script applied before first paint to avoid theme flash
const themeScript = `
(function(){
  try {
    var mode = localStorage.getItem('theme-mode') || 'dark';
    var accent = localStorage.getItem('theme-accent') || 'blue';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-accent', accent);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-accent="blue"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-page">
        {children}
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </body>
    </html>
  );
}
