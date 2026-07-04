import PatientDetailClient from "@/components/PatientDetailClient";

export function generateStaticParams() {
  return [
    { id: "p-1" },
    { id: "p-2" },
    { id: "p-3" },
  ];
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return <PatientDetailClient id={params.id} />;
}
