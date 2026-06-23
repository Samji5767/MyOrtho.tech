import CaseDetailClient from "@/components/CaseDetailClient";

// Known demo case IDs for static export pre-rendering
export function generateStaticParams() {
  return [
    { id: "C-2883" },
    { id: "C-2847" },
    { id: "C-2876" },
    { id: "C-2901" },
    { id: "C-2859" },
    { id: "C-2912" },
    { id: "C-2900" },
  ];
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  return <CaseDetailClient id={params.id} />;
}
