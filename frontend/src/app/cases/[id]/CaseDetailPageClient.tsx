"use client";

import CaseDetailClient from "@/components/CaseDetailClient";

interface Props {
  id: string;
}

// Renders the case detail view for any case ID — pre-rendered demo IDs and
// real UUIDs alike. CaseDetailClient calls the real API first; demo fallback
// data is only used when the network is completely unreachable.
export default function CaseDetailPageClient({ id }: Props) {
  return <CaseDetailClient id={id} />;
}
