"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Layers,
  Plus,
  User,
} from "lucide-react";
import {
  Button,
  Card,
  DataRow,
  EmptyState,
  SectionHeader,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";
import { fetchPatient } from "@/lib/api/patients";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";

function formatDob(dob: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatGender(g: string | null): string {
  if (!g) return "—";
  return g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function caseStatusTone(
  status: string,
): "primary" | "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "active_treatment":
      return "success";
    case "planning":
    case "clinical_review":
    case "scan_review":
      return "warning";
    case "completed":
    case "approved":
      return "primary";
    case "cancelled":
    case "archived":
      return "neutral";
    default:
      return "info";
  }
}

export default function PatientDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
    caseCount: number;
    createdAt: string;
  } | null>(null);
  const [patientCases, setPatientCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [patRes, casesRes] = await Promise.allSettled([
        fetchPatient(id),
        fetchCases(),
      ]);

      if (patRes.status === "fulfilled") {
        const p = patRes.value.data;
        setPatient({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth ?? null,
          gender: p.gender ?? null,
          caseCount: p.caseCount ?? 0,
          createdAt: p.createdAt,
        });
      } else {
        setNotFound(true);
      }

      if (casesRes.status === "fulfilled") {
        const matched = casesRes.value.cases.filter(
          (c) => c.patient.id === id,
        );
        setPatientCases(matched);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-container space-y-4 pt-4">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-32 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    );
  }

  if (notFound || !patient) {
    return (
      <div className="page-container pt-10">
        <EmptyState
          icon={User}
          title="Patient not found"
          body="This patient record may have been removed or you may not have access."
        />
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Go back
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase();
  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <div className="page-container space-y-6 pb-24 pt-4">
      {/* Back nav */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Patients
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-lg font-bold text-[color:var(--primary)]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {fullName}
          </h1>
          <p className="mt-0.5 text-xs text-secondary">
            {patient.caseCount} case{patient.caseCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Details */}
      <Card className="p-4">
        <SectionHeader eyebrow="Patient" title="Details" />
        <div className="mt-4 space-y-0">
          <DataRow label="Full name" value={fullName} />
          <DataRow label="Date of birth" value={formatDob(patient.dateOfBirth)} />
          <DataRow label="Gender" value={formatGender(patient.gender)} />
          <DataRow
            label="Registered"
            value={new Date(patient.createdAt).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </div>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/studio`}>
          <Button variant="secondary" size="sm">
            <Layers size={14} /> Open Studio
          </Button>
        </Link>
        <Link href={`/cases?new=1&patientId=${patient.id}`}>
          <Button variant="primary" size="sm">
            <Plus size={14} /> New Case
          </Button>
        </Link>
      </div>

      {/* Cases */}
      <div className="space-y-3">
        <SectionHeader
          eyebrow="Clinical"
          title="Cases"
          action={
            patientCases.length > 0 ? (
              <Link href="/cases">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            ) : undefined
          }
        />
        {patientCases.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No cases yet"
            body="Create a new case to start the clinical workflow for this patient."
          />
        ) : (
          <div className="space-y-2">
            {patientCases.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="block">
                <Card className="interactive-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.chiefComplaint ?? "No chief complaint"}
                      </p>
                      {c.malocclusionClass && (
                        <p className="mt-0.5 truncate text-xs text-secondary">
                          {c.malocclusionClass}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays size={11} aria-hidden />
                        {new Date(c.updatedAt).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <StatusBadge tone={caseStatusTone(c.status)}>
                      {c.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
