import CaseDetailPageClient from "./CaseDetailPageClient";

// Pre-render known demo IDs for fast initial load. All other IDs (real case
// UUIDs) are handled client-side: Nginx serves /cases/index.html as a fallback,
// the Next.js router matches the [id] segment, and CaseDetailPageClient renders
// the case via the live API — no redirect required.
const STATIC_IDS = ["C-2883", "C-2847", "C-2876", "C-2901", "C-2859", "C-2912", "C-2900"];

export function generateStaticParams() {
  return STATIC_IDS.map((id) => ({ id }));
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  return <CaseDetailPageClient id={params.id} />;
}
