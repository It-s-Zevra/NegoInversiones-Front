import type { Metadata } from "next";
import { Space_Grotesk, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";

// Tipografía única y minimalista:
//  - Space Grotesk para display/marca (carácter distintivo).
//  - Hanken Grotesk para cuerpo/datos (lectura limpia en tablas).
const fontDisplay = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  display: "swap",
});

const fontSans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NegoInversiones · Panel Admin",
    template: "%s · NegoInversiones",
  },
  description:
    "Panel de administración de NegoInversiones: proyectos, unidades, ventas y financiamiento.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
