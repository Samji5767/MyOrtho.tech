import { Patient, Case, Printer, PrintJob } from "@/types";
import { supabase, ensureAuth } from "@/lib/supabase";

// Setup storage key constants for localStorage fallback
const PATIENTS_KEY = "myortho_patients";
const CASES_KEY = "myortho_cases";
const PRINTERS_KEY = "myortho_printers";
const PRINT_JOBS_KEY = "myortho_print_jobs";
const APPOINTMENTS_KEY = "myortho_appointments";
const SECURITY_KEY = "myortho_security_settings";
const AUDIT_LOGS_KEY = "myortho_audit_logs";
const BILLING_KEY = "myortho_billing_data";
const COMMUNICATIONS_KEY = "myortho_communications";

const defaultOrganizationId = "d0b1a2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c";
const defaultProfileId = "e1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d";

// Helper to check if Supabase is fully configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key && !url.includes("placeholder") && key !== "placeholder";
};

// Helper to delay simulation (shows off premium loading states/skeletons)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Default seed data matching initial mockup structures
const defaultPatients: Patient[] = [
  { id: "p1", firstName: "Eleanor", lastName: "Vance", dob: "1994-08-12", gender: "Female", clinicalNotes: "Class II Malocclusion, crowding in mandibular anterior sector.", createdAt: "2026-05-10" },
  { id: "p2", firstName: "Julian", lastName: "Kerr", dob: "1988-11-23", gender: "Male", clinicalNotes: "Diastema between upper central incisors, minor deep bite.", createdAt: "2026-05-15" },
  { id: "p3", firstName: "Amara", lastName: "Sato", dob: "2001-03-04", gender: "Female", clinicalNotes: "Open bite, requires segmentation and 24 aligner stages.", createdAt: "2026-06-01" }
];

const defaultCases: Case[] = [
  { id: "c1", patientId: "p1", patientName: "Eleanor Vance", status: "planning", currentStageId: "s1", notes: "Requires upper/lower clear aligners. 18 maxillary stages.", createdAt: "2026-05-10", updatedAt: "2026-06-12" },
  { id: "c2", patientId: "p2", patientName: "Julian Kerr", status: "pending_approval", currentStageId: "s2", notes: "Awaiting approval for stage layout. IPR required at tooth 11/21.", createdAt: "2026-05-15", updatedAt: "2026-06-13" },
  { id: "c3", patientId: "p3", patientName: "Amara Sato", status: "manufacturing", currentStageId: "s3", notes: "Aligner model generation complete. Print jobs in queue.", createdAt: "2026-06-01", updatedAt: "2026-06-14" }
];

const defaultPrinters: Printer[] = [
  { id: "pr1", name: "Formlabs 3B+ (Lab A)", brand: "Formlabs", model: "Form 3B+", status: "printing", materialType: "Draft Resin V2", materialVolumeMl: 850, ipAddress: "192.168.1.45", createdAt: "2026-04-12" },
  { id: "pr2", name: "SprintRay Pro 95S", brand: "SprintRay", model: "Pro 95S", status: "idle", materialType: "Model Gray", materialVolumeMl: 1200, ipAddress: "192.168.1.48", createdAt: "2026-04-20" },
  { id: "pr3", name: "Asiga Max UV", brand: "Asiga", model: "Max UV", status: "offline", materialType: "Ortho Model", materialVolumeMl: 400, ipAddress: "192.168.1.52", createdAt: "2026-05-02" }
];

const defaultPrintJobs: PrintJob[] = [
  { id: "job1", printerId: "pr1", printerName: "Formlabs 3B+", stageNumber: 4, patientName: "Eleanor Vance", status: "printing", qualityScore: 0.98, createdAt: "2026-06-14" },
  { id: "job2", printerId: "pr2", printerName: "SprintRay Pro 95S", stageNumber: 8, patientName: "Julian Kerr", status: "queued", qualityScore: 0.95, createdAt: "2026-06-14" },
  { id: "job3", printerId: "pr1", printerName: "Formlabs 3B+", stageNumber: 12, patientName: "Amara Sato", status: "completed", qualityScore: 0.99, createdAt: "2026-06-14" },
  { id: "job4", printerId: "pr3", printerName: "Asiga Max UV", stageNumber: 1, patientName: "Aiden Cross", status: "failed", qualityScore: 0.74, qcNotes: "Thin wall risk failed at buccal shell", createdAt: "2026-06-13" }
];

const defaultAppointments = [
  { id: "appt-1", title: "Orthodontic Staging Progress Check", dateTime: "Tuesday, June 23 at 10:30 AM", doctor: "Dr. Sarah Jenkins Clinic" }
];

const defaultSecuritySettings = {
  ssoEnabled: true,
  mfaEnforced: true,
  domain: "https://portal.myortho.tech"
};

const defaultAuditLogs = [
  { timestamp: "2026-06-14 21:12:05", user: "sarah.jenkins@myortho.tech", action: "Approved Case #c1 Staging Plan", ip: "192.168.1.104", severity: "info" },
  { timestamp: "2026-06-14 20:45:12", user: "system-worker", action: "AI Scan Segmentation Completed", ip: "10.0.4.88", severity: "info" },
  { timestamp: "2026-06-14 18:22:30", user: "operator-bill", action: "Resin Low Warning: Formlabs Printer 1", ip: "192.168.1.45", severity: "warning" },
  { timestamp: "2026-06-14 15:10:04", user: "unknown-admin", action: "Failed Login Attempt: Tenant Portal", ip: "203.0.113.19", severity: "critical" }
];

const defaultBilling = {
  meters: { caseExports: 12, apiCalls: 1245, resinMl: 450, storageGb: 48 },
  subscription: { planTier: "premium", monthlyPrice: 599, status: "active" },
  invoices: [
    { id: "inv-9901", billingPeriod: "May 2026", totalCost: 485.45, status: "paid", invoiceDate: "2026-06-01" },
    { id: "inv-9854", billingPeriod: "Apr 2026", totalCost: 390.12, status: "paid", invoiceDate: "2026-05-01" }
  ]
};

const defaultComments = [
  "Dr. Sam: Posterior crossbite alignment looks good. Attachment on tooth 13 is crucial.",
  "Lab Tech: Watertight STL staging models sliced and validated."
];

const defaultSupportMessages = [
  { sender: "clinic", text: "Let us know if you feel minor tightness on aligner #4. That is normal for the first 48 hours." }
];

const defaultConsents = [
  { name: "HIPAA Data Sharing Consent", signedAt: "2026-06-12 11:22", hash: "SHA-256: 4f18e9a...", status: "Signed" },
  { name: "Aligner Treatment Informed Consent", signedAt: "2026-06-12 11:25", hash: "SHA-256: 9b2d8e...", status: "Signed" }
];

// Initializer helper for LocalStorage Fallback
const getStoredData = <T>(key: string, defaults: T): T => {
  if (typeof window === "undefined") return defaults;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(data) as T;
};

const setStoredData = <T>(key: string, data: T): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

// Database ID translation helpers to preserve backward compatibility with mock keys
const resolveCaseId = (id: string): string => {
  if (id === "c1" || id === "case-1") return "c1111111-1111-1111-1111-111111111111";
  if (id === "c2" || id === "case-2") return "c2222222-2222-2222-2222-222222222222";
  if (id === "c3" || id === "case-3") return "c3333333-3333-3333-3333-333333333333";
  return id;
};

const resolvePatientId = (id: string): string => {
  if (id === "p1" || id === "patient-1") return "11111111-1111-1111-1111-111111111111";
  if (id === "p2" || id === "patient-2") return "22222222-2222-2222-2222-222222222222";
  if (id === "p3" || id === "patient-3") return "33333333-3333-3333-3333-333333333333";
  return id;
};

// Database Row Mappers to protect types and camelCase conversions
const mapPatient = (row: any): Patient => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  dob: row.dob,
  gender: row.gender,
  clinicalNotes: row.clinical_notes,
  createdAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : ""
});

const mapCase = (row: any): Case => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patients ? `${row.patients.first_name} ${row.patients.last_name}` : "Unknown Patient",
  status: row.status,
  currentStageId: row.current_stage_id,
  notes: row.notes,
  createdAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "",
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().split("T")[0] : ""
});

const mapPrinter = (row: any): Printer => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  model: row.model,
  status: row.status,
  materialType: row.material_type,
  materialVolumeMl: row.material_volume_ml,
  ipAddress: row.ip_address,
  createdAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : ""
});

const mapPrintJob = (row: any): PrintJob => ({
  id: row.id,
  printerId: row.printer_id,
  printerName: row.printers ? row.printers.name : "Unknown Printer",
  stageNumber: row.aligner_stages ? row.aligner_stages.stage_number : 1,
  patientName: row.aligner_stages?.treatment_plans?.cases?.patients
    ? `${row.aligner_stages.treatment_plans.cases.patients.first_name} ${row.aligner_stages.treatment_plans.cases.patients.last_name}`
    : "Unknown Patient",
  status: row.status,
  qualityScore: row.quality_score,
  qcNotes: row.qc_notes,
  createdAt: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : ""
});

const mapAppointment = (row: any): any => ({
  id: row.id,
  title: row.visit_reason,
  dateTime: new Date(row.scheduled_at).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }) + " at " + new Date(row.scheduled_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }),
  doctor: "Dr. Sarah Jenkins Clinic"
});

export const apiService = {
  // Patients API
  async getPatients(): Promise<Patient[]> {
    await delay(150);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("organization_id", defaultOrganizationId);
      if (error) {
        console.error("Supabase getPatients error:", error.message);
      } else if (data) {
        return data.map(mapPatient);
      }
    }
    return getStoredData(PATIENTS_KEY, defaultPatients);
  },

  async createPatient(firstName: string, lastName: string, dob: string, gender: string, clinicalNotes: string): Promise<Patient> {
    await delay(200);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("patients")
        .insert({
          organization_id: defaultOrganizationId,
          first_name: firstName,
          last_name: lastName,
          dob,
          gender,
          clinical_notes: clinicalNotes
        })
        .select()
        .single();
      if (error) {
        console.error("Supabase createPatient error:", error.message);
      } else if (data) {
        return mapPatient(data);
      }
    }
    const patients = getStoredData<Patient[]>(PATIENTS_KEY, defaultPatients);
    const newPatient: Patient = {
      id: `p${patients.length + 1}`,
      firstName,
      lastName,
      dob,
      gender,
      clinicalNotes,
      createdAt: new Date().toISOString().split("T")[0]
    };
    patients.push(newPatient);
    setStoredData(PATIENTS_KEY, patients);
    return newPatient;
  },

  // Cases API
  async getCases(): Promise<Case[]> {
    await delay(150);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("cases")
        .select("*, patients(*)");
      if (error) {
        console.error("Supabase getCases error:", error.message);
      } else if (data) {
        return data.map(mapCase);
      }
    }
    return getStoredData(CASES_KEY, defaultCases);
  },

  async createCase(patientId: string, patientName: string, notes: string): Promise<Case> {
    await delay(200);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedPatientId = resolvePatientId(patientId);
      const { data, error } = await supabase
        .from("cases")
        .insert({
          patient_id: resolvedPatientId,
          dentist_id: defaultProfileId,
          status: "draft",
          notes
        })
        .select("*, patients(*)")
        .single();
      if (error) {
        console.error("Supabase createCase error:", error.message);
      } else if (data) {
        return mapCase(data);
      }
    }
    const cases = getStoredData<Case[]>(CASES_KEY, defaultCases);
    const newCase: Case = {
      id: `c${cases.length + 1}`,
      patientId,
      patientName,
      status: "draft",
      notes,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0]
    };
    cases.push(newCase);
    setStoredData(CASES_KEY, cases);
    return newCase;
  },

  async updateCaseStatus(id: string, status: Case["status"]): Promise<Case> {
    await delay(150);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("cases")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, patients(*)")
        .single();
      if (error) {
        console.error("Supabase updateCaseStatus error:", error.message);
      } else if (data) {
        return mapCase(data);
      }
    }
    const cases = getStoredData<Case[]>(CASES_KEY, defaultCases);
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Case not found");
    cases[idx] = {
      ...cases[idx],
      status,
      updatedAt: new Date().toISOString().split("T")[0]
    };
    setStoredData(CASES_KEY, cases);
    return cases[idx];
  },

  // Printers API
  async getPrinters(): Promise<Printer[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("organization_id", defaultOrganizationId);
      if (error) {
        console.error("Supabase getPrinters error:", error.message);
      } else if (data) {
        return data.map(mapPrinter);
      }
    }
    return getStoredData(PRINTERS_KEY, defaultPrinters);
  },

  async simulatePrinterCycle(id: string): Promise<Printer> {
    await delay(200);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: printer } = await supabase.from("printers").select("*").eq("id", id).single();
      if (printer) {
        const nextStatus = printer.status === "idle" ? "printing" : "idle";
        const volumeReduced = nextStatus === "printing" ? 80 : 0;
        const { data, error } = await supabase
          .from("printers")
          .update({
            status: nextStatus,
            material_volume_ml: Math.max(0, printer.material_volume_ml - volumeReduced)
          })
          .eq("id", id)
          .select()
          .single();
        if (error) {
          console.error("Supabase simulatePrinterCycle error:", error.message);
        } else if (data) {
          return mapPrinter(data);
        }
      }
    }
    const printers = getStoredData<Printer[]>(PRINTERS_KEY, defaultPrinters);
    const idx = printers.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Printer not found");
    const currentStatus = printers[idx].status;
    const nextStatus: Printer["status"] = currentStatus === "idle" ? "printing" : "idle";
    const volumeReduced = nextStatus === "printing" ? 80 : 0;
    printers[idx] = {
      ...printers[idx],
      status: nextStatus,
      materialVolumeMl: Math.max(0, printers[idx].materialVolumeMl - volumeReduced)
    };
    setStoredData(PRINTERS_KEY, printers);
    return printers[idx];
  },

  // Print Jobs API
  async getPrintJobs(): Promise<PrintJob[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("print_jobs")
        .select(`
          *,
          printers(*),
          aligner_stages(
            stage_number,
            treatment_plans(
              cases(
                patients(
                  first_name,
                  last_name
                )
              )
            )
          )
        `)
        .eq("organization_id", defaultOrganizationId);
      if (error) {
        console.error("Supabase getPrintJobs error:", error.message);
      } else if (data) {
        return data.map(mapPrintJob);
      }
    }
    return getStoredData(PRINT_JOBS_KEY, defaultPrintJobs);
  },

  // Appointments API
  async getAppointments(): Promise<any[]> {
    await delay(150);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(*)");
      if (error) {
        console.error("Supabase getAppointments error:", error.message);
      } else if (data) {
        return data.map(mapAppointment);
      }
    }
    return getStoredData(APPOINTMENTS_KEY, defaultAppointments);
  },

  async createAppointment(title: string, dateTime: string, doctor: string): Promise<any> {
    await delay(200);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          patient_id: "11111111-1111-1111-1111-111111111111", // Eleanor Vance default patient UUID
          dentist_id: defaultProfileId,
          scheduled_at: new Date(dateTime.replace(" at ", " ")).toISOString(),
          visit_reason: title,
          status: "scheduled"
        })
        .select()
        .single();
      if (error) {
        console.error("Supabase createAppointment error:", error.message);
      } else if (data) {
        return mapAppointment(data);
      }
    }
    const appts = getStoredData<any[]>(APPOINTMENTS_KEY, defaultAppointments);
    const newAppt = {
      id: `appt-${appts.length + 1}`,
      title,
      dateTime,
      doctor
    };
    appts.push(newAppt);
    setStoredData(APPOINTMENTS_KEY, appts);
    return newAppt;
  },

  // Security Settings API
  async getSecuritySettings(): Promise<typeof defaultSecuritySettings> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", defaultOrganizationId)
        .single();
      if (error) {
        console.error("Supabase getSecuritySettings error:", error.message);
      } else if (data && data.settings) {
        return {
          ssoEnabled: data.settings.ssoEnabled ?? true,
          mfaEnforced: data.settings.mfaEnforced ?? true,
          domain: data.settings.domain ?? "https://portal.myortho.tech"
        };
      }
    }
    return getStoredData(SECURITY_KEY, defaultSecuritySettings);
  },

  async updateSecuritySettings(ssoEnabled: boolean, mfaEnforced: boolean): Promise<typeof defaultSecuritySettings> {
    await delay(150);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: org } = await supabase.from("organizations").select("settings").eq("id", defaultOrganizationId).single();
      const updatedSettings = { ...(org?.settings || {}), ssoEnabled, mfaEnforced };
      const { error } = await supabase
        .from("organizations")
        .update({ settings: updatedSettings })
        .eq("id", defaultOrganizationId);
      if (error) {
        console.error("Supabase updateSecuritySettings error:", error.message);
      } else {
        return { ssoEnabled, mfaEnforced, domain: org?.settings?.domain || "https://portal.myortho.tech" };
      }
    }
    const settings = { ...defaultSecuritySettings, ssoEnabled, mfaEnforced };
    setStoredData(SECURITY_KEY, settings);
    return settings;
  },

  // Audit Logs API
  async getAuditLogs(): Promise<any[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(email)")
        .eq("organization_id", defaultOrganizationId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase getAuditLogs error:", error.message);
      } else if (data) {
        return data.map(row => ({
          timestamp: new Date(row.created_at).toISOString().replace("T", " ").split(".")[0],
          user: row.profiles?.email || "system-worker",
          action: row.action,
          ip: row.ip_address || "127.0.0.1",
          severity: (row.details?.severity || "info") as "info" | "warning" | "critical"
        }));
      }
    }
    return getStoredData(AUDIT_LOGS_KEY, defaultAuditLogs);
  },

  // Billing subscriptions and Usage Meters API
  async getBillingData(): Promise<any> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      // Fetch subscription
      const { data: sub } = await supabase.from("billing_subscriptions").select("*").eq("organization_id", defaultOrganizationId).maybeSingle();
      // Fetch usage meters
      const { data: meters } = await supabase.from("billing_usage_meters").select("*").eq("organization_id", defaultOrganizationId);
      
      const mappedSub = sub ? {
        planTier: sub.plan_tier,
        monthlyPrice: sub.monthly_price,
        status: sub.status
      } : defaultBilling.subscription;

      const mappedMeters = {
        caseExports: 0,
        apiCalls: 0,
        resinMl: 0,
        storageGb: 0
      };

      if (meters) {
        meters.forEach(m => {
          if (m.metric_type === "case_export") mappedMeters.caseExports += m.quantity;
          if (m.metric_type === "api_call") mappedMeters.apiCalls += m.quantity;
          if (m.metric_type === "resin_print_ml") mappedMeters.resinMl += m.quantity;
          if (m.metric_type === "storage_gb") mappedMeters.storageGb += m.quantity;
        });
      }

      return {
        subscription: mappedSub,
        meters: mappedMeters,
        invoices: defaultBilling.invoices // Maintain invoice records fallback
      };
    }
    return getStoredData(BILLING_KEY, defaultBilling);
  },

  // Case Comments API
  async getCaseComments(caseId: string): Promise<string[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedCaseId = resolveCaseId(caseId);
      const { data, error } = await supabase
        .from("model_comments")
        .select("*")
        .eq("case_id", resolvedCaseId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Supabase getCaseComments error:", error.message);
      } else if (data) {
        return data.map(c => c.comment_text);
      }
    }
    return getStoredData(`${COMMUNICATIONS_KEY}_comments_${caseId}`, defaultComments);
  },

  async addCaseComment(caseId: string, author: string, text: string): Promise<string> {
    await delay(100);
    const commentWithAuthor = `${author}: ${text}`;
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedCaseId = resolveCaseId(caseId);
      const { error } = await supabase
        .from("model_comments")
        .insert({
          case_id: resolvedCaseId,
          author_id: defaultProfileId,
          comment_text: commentWithAuthor,
          coordinate_x: 0,
          coordinate_y: 0,
          coordinate_z: 0
        });
      if (error) {
        console.error("Supabase addCaseComment error:", error.message);
      } else {
        return commentWithAuthor;
      }
    }
    const comments = getStoredData<string[]>(`${COMMUNICATIONS_KEY}_comments_${caseId}`, defaultComments);
    comments.push(commentWithAuthor);
    setStoredData(`${COMMUNICATIONS_KEY}_comments_${caseId}`, comments);
    return commentWithAuthor;
  },

  // Support messages API
  async getSupportMessages(caseId: string): Promise<any[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedCaseId = resolveCaseId(caseId);
      const { data: conversations } = await supabase.from("conversations").select("id").eq("case_id", resolvedCaseId).limit(1);
      if (conversations && conversations.length > 0) {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversations[0].id)
          .order("created_at", { ascending: true });
        if (error) {
          console.error("Supabase getSupportMessages error:", error.message);
        } else if (data) {
          return data.map(m => ({
            sender: m.sender_id === defaultProfileId ? "patient" : "clinic",
            text: m.text
          }));
        }
      }
    }
    return getStoredData(`${COMMUNICATIONS_KEY}_support_${caseId}`, defaultSupportMessages);
  },

  async sendSupportMessage(caseId: string, sender: "patient" | "clinic", text: string): Promise<any> {
    await delay(100);
    const msg = { sender, text };
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedCaseId = resolveCaseId(caseId);
      let { data: conv } = await supabase.from("conversations").select("id").eq("case_id", resolvedCaseId).limit(1).maybeSingle();
      if (!conv) {
        const { data: newConv } = await supabase.from("conversations").insert({ case_id: resolvedCaseId }).select().single();
        conv = newConv;
        if (conv) {
          await supabase.from("participants").insert({ conversation_id: conv.id, profile_id: defaultProfileId });
        }
      }
      if (conv) {
        const { error } = await supabase
          .from("messages")
          .insert({
            conversation_id: conv.id,
            sender_id: sender === "patient" ? defaultProfileId : null, // patient references Sarah Profile in our seed
            text
          });
        if (error) {
          console.error("Supabase sendSupportMessage error:", error.message);
        } else {
          return msg;
        }
      }
    }
    const msgs = getStoredData<any[]>(`${COMMUNICATIONS_KEY}_support_${caseId}`, defaultSupportMessages);
    msgs.push(msg);
    setStoredData(`${COMMUNICATIONS_KEY}_support_${caseId}`, msgs);
    return msg;
  },

  // Consent Records API
  async getConsentRecords(patientId: string): Promise<any[]> {
    await delay(100);
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const resolvedPatientId = resolvePatientId(patientId);
      const { data, error } = await supabase
        .from("legal_consent_records")
        .select("*")
        .eq("patient_id", resolvedPatientId)
        .order("esign_timestamp", { ascending: false });
      if (error) {
        console.error("Supabase getConsentRecords error:", error.message);
      } else if (data) {
        return data.map(r => ({
          name: r.esign_signature,
          signedAt: new Date(r.esign_timestamp).toISOString().replace("T", " ").substring(0, 16),
          hash: r.document_hash,
          status: "Signed"
        }));
      }
    }
    return getStoredData(`${COMMUNICATIONS_KEY}_consents_${patientId}`, defaultConsents);
  }
};
