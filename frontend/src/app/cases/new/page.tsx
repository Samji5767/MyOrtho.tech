import NewCaseWizard from "@/components/workflow/NewCaseWizard";

export const metadata = {
  title: "New Case | MyOrtho",
};

export default function NewCasePage() {
  return (
    <section className="animate-page-enter w-full">
      <div className="mx-auto max-w-2xl px-4 pt-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Clinical Workflow
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          New Case
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Create a patient record and define treatment objectives.
        </p>
      </div>
      <NewCaseWizard />
    </section>
  );
}
