import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "MyOrtho — Clinical Operating System for Orthodontics",
  description:
    "The complete orthodontic platform. AI tooth segmentation, treatment planning, aligner design, and production-ready STL export. Free for individual orthodontists.",
  keywords: [
    "orthodontics software",
    "aligner design",
    "AI tooth segmentation",
    "clear aligners",
    "dental treatment planning",
    "orthodontic CAD",
    "HIPAA compliant dental",
  ],
  metadataBase: new URL("https://www.myortho.tech"),
  alternates: { canonical: "https://www.myortho.tech" },
  openGraph: {
    type: "website",
    url: "https://www.myortho.tech",
    title: "MyOrtho — Clinical Operating System for Orthodontics",
    description:
      "AI-powered orthodontic platform. Scan to production-ready aligners in 8 steps.",
    siteName: "MyOrtho",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MyOrtho Clinical OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MyOrtho — Clinical OS for Orthodontics",
    description:
      "AI-powered orthodontic platform. Scan to production-ready aligners in 8 steps.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function Page() {
  return <LandingPage />;
}
