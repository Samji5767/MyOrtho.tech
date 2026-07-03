import { Patient, Case, Printer, PrintJob } from "@/types";
import { supabase, ensureAuth } from "@/lib/supabase";
import { safeStorage } from "@/lib/safeStorage";

const PATIENTS_KEY = "myortho_patients";
const CASES_KEY = "myortho_cases";
const PRINTERS_KEY = "myortho_printers";
const PRINT_JOBS_KEY = "myortho_print_jobs";
const APPOINTMENTS_KEY = "myortho_appointments";
const SECURITY_KEY = "myortho_security_settings";
const AUDIT_LOGS_KEY = "myortho_audit_logs";
const BILLING_KEY = "myortho_billing_data";
const COMMUNICATIONS_KEY = "myortho_communications";

const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key && !url.includes("placeholder") && key !== "placeholder";
};

const getStoredData = <T>(key: string, fallback: T): T =>
  safeStorage.getJSON<T>(key) ?? fallback;

const setStoredData = <T>(key: string, data: T): void => {
  safeStorage.setJSON(key, data);
};

// Row mappers for Supabase → domain types
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
  doctor: row.profiles?.full_name ?? ""
});

type SecuritySettings = {
  ssoEnabled: boolean;
  mfaEnforced: boolean;
  domain: string;
};

const emptySecuritySettings: SecuritySettings = {
  ssoEnabled: false,
  mfaEnforced: false,
  domain: ""
};

// Resolved at runtime from environment — no hardcoded org/profile IDs
const orgId = () => process.env.NEXT_PUBLIC_ORG_ID ?? "";
const profileId = () => process.env.NEXT_PUBLIC_PROFILE_ID ?? "";

export const apiService = {
  // Patients
  async getPatients(): Promise<Patient[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("organization_id", orgId());
      if (error) {
        console.error("Supabase getPatients error:", error.message);
      } else if (data) {
        return data.map(mapPatient);
      }
    }
    return getStoredData<Patient[]>(PATIENTS_KEY, []);
  },

  async createPatient(firstName: string, lastName: string, dob: string, gender: string, clinicalNotes: string): Promise<Patient> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("patients")
        .insert({
          organization_id: orgId(),
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
    const patients = getStoredData<Patient[]>(PATIENTS_KEY, []);
    const newPatient: Patient = {
      id: `local-${Date.now()}`,
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

  // Cases
  async getCases(): Promise<Case[]> {
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
    return getStoredData<Case[]>(CASES_KEY, []);
  },

  async createCase(patientId: string, patientName: string, notes: string): Promise<Case> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("cases")
        .insert({
          patient_id: patientId,
          dentist_id: profileId(),
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
    const cases = getStoredData<Case[]>(CASES_KEY, []);
    const newCase: Case = {
      id: `local-${Date.now()}`,
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
    const cases = getStoredData<Case[]>(CASES_KEY, []);
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Case not found");
    cases[idx] = { ...cases[idx], status, updatedAt: new Date().toISOString().split("T")[0] };
    setStoredData(CASES_KEY, cases);
    return cases[idx];
  },

  // Printers
  async getPrinters(): Promise<Printer[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("printers")
        .select("*")
        .eq("organization_id", orgId());
      if (error) {
        console.error("Supabase getPrinters error:", error.message);
      } else if (data) {
        return data.map(mapPrinter);
      }
    }
    return getStoredData<Printer[]>(PRINTERS_KEY, []);
  },

  async simulatePrinterCycle(id: string): Promise<Printer> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: printer } = await supabase.from("printers").select("*").eq("id", id).single();
      if (printer) {
        const nextStatus = printer.status === "idle" ? "printing" : "idle";
        const volumeReduced = nextStatus === "printing" ? 80 : 0;
        const { data, error } = await supabase
          .from("printers")
          .update({ status: nextStatus, material_volume_ml: Math.max(0, printer.material_volume_ml - volumeReduced) })
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
    const printers = getStoredData<Printer[]>(PRINTERS_KEY, []);
    const idx = printers.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Printer not found");
    const nextStatus: Printer["status"] = printers[idx].status === "idle" ? "printing" : "idle";
    const volumeReduced = nextStatus === "printing" ? 80 : 0;
    printers[idx] = { ...printers[idx], status: nextStatus, materialVolumeMl: Math.max(0, printers[idx].materialVolumeMl - volumeReduced) };
    setStoredData(PRINTERS_KEY, printers);
    return printers[idx];
  },

  // Print Jobs
  async getPrintJobs(): Promise<PrintJob[]> {
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
                patients(first_name, last_name)
              )
            )
          )
        `)
        .eq("organization_id", orgId());
      if (error) {
        console.error("Supabase getPrintJobs error:", error.message);
      } else if (data) {
        return data.map(mapPrintJob);
      }
    }
    return getStoredData<PrintJob[]>(PRINT_JOBS_KEY, []);
  },

  // Appointments
  async getAppointments(): Promise<any[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, patients(*), profiles(full_name)");
      if (error) {
        console.error("Supabase getAppointments error:", error.message);
      } else if (data) {
        return data.map(mapAppointment);
      }
    }
    return getStoredData<any[]>(APPOINTMENTS_KEY, []);
  },

  async createAppointment(title: string, dateTime: string, doctor: string): Promise<any> {
    // TODO: createAppointment requires a patientId parameter for production use
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          dentist_id: profileId(),
          scheduled_at: new Date(dateTime.replace(" at ", " ")).toISOString(),
          visit_reason: title,
          status: "scheduled"
        })
        .select("*, profiles(full_name)")
        .single();
      if (error) {
        console.error("Supabase createAppointment error:", error.message);
      } else if (data) {
        return mapAppointment(data);
      }
    }
    const appts = getStoredData<any[]>(APPOINTMENTS_KEY, []);
    const newAppt = { id: `local-${Date.now()}`, title, dateTime, doctor };
    appts.push(newAppt);
    setStoredData(APPOINTMENTS_KEY, appts);
    return newAppt;
  },

  // Security Settings
  async getSecuritySettings(): Promise<SecuritySettings> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId())
        .single();
      if (error) {
        console.error("Supabase getSecuritySettings error:", error.message);
      } else if (data && data.settings) {
        return {
          ssoEnabled: data.settings.ssoEnabled ?? false,
          mfaEnforced: data.settings.mfaEnforced ?? false,
          domain: data.settings.domain ?? ""
        };
      }
    }
    return getStoredData<SecuritySettings>(SECURITY_KEY, emptySecuritySettings);
  },

  async updateSecuritySettings(ssoEnabled: boolean, mfaEnforced: boolean): Promise<SecuritySettings> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: org } = await supabase.from("organizations").select("settings").eq("id", orgId()).single();
      const updatedSettings = { ...(org?.settings || {}), ssoEnabled, mfaEnforced };
      const { error } = await supabase.from("organizations").update({ settings: updatedSettings }).eq("id", orgId());
      if (error) {
        console.error("Supabase updateSecuritySettings error:", error.message);
      } else {
        return { ssoEnabled, mfaEnforced, domain: org?.settings?.domain ?? "" };
      }
    }
    const settings = { ...emptySecuritySettings, ssoEnabled, mfaEnforced };
    setStoredData(SECURITY_KEY, settings);
    return settings;
  },

  // Audit Logs
  async getAuditLogs(): Promise<any[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(email)")
        .eq("organization_id", orgId())
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Supabase getAuditLogs error:", error.message);
      } else if (data) {
        return data.map(row => ({
          timestamp: new Date(row.created_at).toISOString().replace("T", " ").split(".")[0],
          user: row.profiles?.email || "system",
          action: row.action,
          ip: row.ip_address || "",
          severity: (row.details?.severity || "info") as "info" | "warning" | "critical"
        }));
      }
    }
    return getStoredData<any[]>(AUDIT_LOGS_KEY, []);
  },

  // Billing
  async getBillingData(): Promise<any> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: sub } = await supabase.from("billing_subscriptions").select("*").eq("organization_id", orgId()).maybeSingle();
      const { data: meters } = await supabase.from("billing_usage_meters").select("*").eq("organization_id", orgId());
      const mappedSub = sub ? { planTier: sub.plan_tier, monthlyPrice: sub.monthly_price, status: sub.status } : null;
      const mappedMeters = { caseExports: 0, apiCalls: 0, resinMl: 0, storageGb: 0 };
      if (meters) {
        meters.forEach(m => {
          if (m.metric_type === "case_export") mappedMeters.caseExports += m.quantity;
          if (m.metric_type === "api_call") mappedMeters.apiCalls += m.quantity;
          if (m.metric_type === "resin_print_ml") mappedMeters.resinMl += m.quantity;
          if (m.metric_type === "storage_gb") mappedMeters.storageGb += m.quantity;
        });
      }
      return { subscription: mappedSub, meters: mappedMeters, invoices: [] };
    }
    return getStoredData<any>(BILLING_KEY, null);
  },

  // Case Comments
  async getCaseComments(caseId: string): Promise<string[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("model_comments")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Supabase getCaseComments error:", error.message);
      } else if (data) {
        return data.map(c => c.comment_text);
      }
    }
    return getStoredData<string[]>(`${COMMUNICATIONS_KEY}_comments_${caseId}`, []);
  },

  async addCaseComment(caseId: string, author: string, text: string): Promise<string> {
    const commentWithAuthor = `${author}: ${text}`;
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { error } = await supabase.from("model_comments").insert({
        case_id: caseId,
        author_id: profileId(),
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
    const comments = getStoredData<string[]>(`${COMMUNICATIONS_KEY}_comments_${caseId}`, []);
    comments.push(commentWithAuthor);
    setStoredData(`${COMMUNICATIONS_KEY}_comments_${caseId}`, comments);
    return commentWithAuthor;
  },

  // Support Messages
  async getSupportMessages(caseId: string): Promise<any[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data: conversations } = await supabase.from("conversations").select("id").eq("case_id", caseId).limit(1);
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
            sender: m.sender_id === profileId() ? "patient" : "clinic",
            text: m.text
          }));
        }
      }
    }
    return getStoredData<any[]>(`${COMMUNICATIONS_KEY}_support_${caseId}`, []);
  },

  async sendSupportMessage(caseId: string, sender: "patient" | "clinic", text: string): Promise<any> {
    const msg = { sender, text };
    if (isSupabaseConfigured()) {
      await ensureAuth();
      let { data: conv } = await supabase.from("conversations").select("id").eq("case_id", caseId).limit(1).maybeSingle();
      if (!conv) {
        const { data: newConv } = await supabase.from("conversations").insert({ case_id: caseId }).select().single();
        conv = newConv;
        if (conv) {
          await supabase.from("participants").insert({ conversation_id: conv.id, profile_id: profileId() });
        }
      }
      if (conv) {
        const { error } = await supabase.from("messages").insert({
          conversation_id: conv.id,
          sender_id: sender === "patient" ? profileId() : null,
          text
        });
        if (error) {
          console.error("Supabase sendSupportMessage error:", error.message);
        } else {
          return msg;
        }
      }
    }
    const msgs = getStoredData<any[]>(`${COMMUNICATIONS_KEY}_support_${caseId}`, []);
    msgs.push(msg);
    setStoredData(`${COMMUNICATIONS_KEY}_support_${caseId}`, msgs);
    return msg;
  },

  // Consent Records
  async getConsentRecords(patientId: string): Promise<any[]> {
    if (isSupabaseConfigured()) {
      await ensureAuth();
      const { data, error } = await supabase
        .from("legal_consent_records")
        .select("*")
        .eq("patient_id", patientId)
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
    return getStoredData<any[]>(`${COMMUNICATIONS_KEY}_consents_${patientId}`, []);
  }
};
