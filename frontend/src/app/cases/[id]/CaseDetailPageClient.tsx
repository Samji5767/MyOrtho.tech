"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CaseDetailClient from "@/components/CaseDetailClient";

interface Props {
  id: string;
  isStatic: boolean;
}

export default function CaseDetailPageClient({ id, isStatic }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!isStatic) {
      router.replace(`/cases?id=${encodeURIComponent(id)}`);
    }
  }, [id, isStatic, router]);

  if (!isStatic) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">
        Redirecting to case…
      </div>
    );
  }

  return <CaseDetailClient id={id} />;
}
