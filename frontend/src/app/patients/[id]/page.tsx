import PatientDetailClient from "@/components/PatientDetailClient";

// output: "export" requires generateStaticParams for all dynamic segments.
// The deployed nginx serves the same shell for any /patients/* path;
// real patient data is loaded client-side by PatientDetailClient.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return <PatientDetailClient id={params.id} />;
}
