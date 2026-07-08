"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CaseDetailClient from "@/components/CaseDetailClient";

// Pre-render known demo IDs for static export; all other IDs are handled
// client-side — the redirect below sends real case IDs to /cases?id=<id>
// where CaseDetailClient is embedded in the live split-view.

const STATIC_IDS = ["C-2883", "C-2847", "C-2876", "C-2901", "C-2859", "C-2912", "C-2900"];

export function generateStaticParams() {
  return STATIC_IDS.map((id) => ({ id }));
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  // If the ID isn't one of the pre-rendered static IDs, redirect to the
  // cases list page which can handle any live case ID via its inline panel.
  useEffect(() => {
    if (!STATIC_IDS.includes(id)) {
      router.replace(`/cases?id=${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  if (!STATIC_IDS.includes(id)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">
        Redirecting to case…
      </div>
    );
  }

  return <CaseDetailClient id={id} />;
}
