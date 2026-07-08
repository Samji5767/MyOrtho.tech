import CaseDetailPageClient from "./CaseDetailPageClient";

// Pre-render known demo IDs for static export; all other IDs are handled
// client-side — the redirect below sends real case IDs to /cases?id=<id>
// where CaseDetailClient is embedded in the live split-view.

const STATIC_IDS = ["C-2883", "C-2847", "C-2876", "C-2901", "C-2859", "C-2912", "C-2900"];

export function generateStaticParams() {
  return STATIC_IDS.map((id) => ({ id }));
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  return <CaseDetailPageClient id={params.id} isStatic={STATIC_IDS.includes(params.id)} />;
}
