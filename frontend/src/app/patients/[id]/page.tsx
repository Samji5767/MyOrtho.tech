import PatientDetailClient from "@/components/PatientDetailClient";

export const dynamic = "force-dynamic";

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return <PatientDetailClient id={params.id} />;
}
