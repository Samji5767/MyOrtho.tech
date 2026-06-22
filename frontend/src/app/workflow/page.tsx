import ClinicalWorkflow from "@/components/ClinicalWorkflow";
import AuditTrail from "@/components/AuditTrail";

export const metadata = {
  title: "Clinical Workflow | MyOrtho",
};

export default function WorkflowPage() {
  return (
    <section className="animate-page-enter w-full">
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Clinical Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          Clinical Workflow
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Case approval pipeline, reviewer notes, and FDA/MDR-style audit trail.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-5">
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-0">
            <ClinicalWorkflow
              caseId="DEMO-001"
              caseName="Sample Patient — Class I, Moderate Crowding"
              initialStatus="clinical-review"
              currentActor="Dr. Demo"
              currentActorRole="Clinical Director"
            />
          </div>
          <div>
            <AuditTrail caseId="DEMO-001" isLive={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
