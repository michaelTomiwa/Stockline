import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Stockline — inventory for every store you run", template: "%s · Stockline" },
  description: "Track stock across all your stores: what came in, what sold, what moved and what's running low.",
};

export const viewport: Viewport = { themeColor: "#0f201a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${schibsted.variable} ${jetbrains.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
