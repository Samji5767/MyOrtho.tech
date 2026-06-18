import { useState, useEffect, useCallback } from "react";
import { Case, Patient, Printer, PrintJob } from "@/types";
import { apiService } from "@/services/api";

export function useCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getCases();
      setCases(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const createCase = async (patientId: string, patientName: string, notes: string) => {
    try {
      const newCase = await apiService.createCase(patientId, patientName, notes);
      setCases(prev => [...prev, newCase]);
      return newCase;
    } catch (err: any) {
      throw new Error(err.message || "Failed to create case");
    }
  };

  const updateCaseStatus = async (id: string, status: Case["status"]) => {
    try {
      const updatedCase = await apiService.updateCaseStatus(id, status);
      setCases(prev => prev.map(c => c.id === id ? updatedCase : c));
      return updatedCase;
    } catch (err: any) {
      throw new Error(err.message || "Failed to update case status");
    }
  };

  return { cases, loading, error, refetch: fetchCases, createCase, updateCaseStatus };
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getPatients();
      setPatients(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const createPatient = async (firstName: string, lastName: string, dob: string, gender: string, clinicalNotes: string) => {
    try {
      const newPatient = await apiService.createPatient(firstName, lastName, dob, gender, clinicalNotes);
      setPatients(prev => [...prev, newPatient]);
      // Also automatically initialize a case for this patient
      await apiService.createCase(newPatient.id, `${firstName} ${lastName}`, clinicalNotes);
      return newPatient;
    } catch (err: any) {
      throw new Error(err.message || "Failed to create patient");
    }
  };

  return { patients, loading, error, refetch: fetchPatients, createPatient };
}

export function usePrinters() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrinters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getPrinters();
      setPrinters(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load printers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  const simulateCycle = async (id: string) => {
    try {
      const updated = await apiService.simulatePrinterCycle(id);
      setPrinters(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    } catch (err: any) {
      throw new Error(err.message || "Failed to simulate telemetry cycle");
    }
  };

  return { printers, loading, error, refetch: fetchPrinters, simulateCycle };
}

export function usePrintJobs() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getPrintJobs();
      setJobs(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getAppointments();
      setAppointments(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const bookAppointment = async (title: string, dateTime: string, doctor: string) => {
    try {
      const newAppt = await apiService.createAppointment(title, dateTime, doctor);
      setAppointments(prev => [...prev, newAppt]);
      return newAppt;
    } catch (err: any) {
      throw new Error(err.message || "Failed to schedule appointment");
    }
  };

  return { appointments, loading, error, refetch: fetchAppointments, bookAppointment };
}

export function useSecurity() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getSecuritySettings();
      setSettings(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load security settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (ssoEnabled: boolean, mfaEnforced: boolean) => {
    try {
      const updated = await apiService.updateSecuritySettings(ssoEnabled, mfaEnforced);
      setSettings(updated);
      return updated;
    } catch (err: any) {
      throw new Error(err.message || "Failed to save security settings");
    }
  };

  return { settings, loading, error, refetch: fetchSettings, saveSettings };
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getAuditLogs();
      setLogs(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}

export function useBilling() {
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getBillingData();
      setBillingData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  return { billingData, loading, error, refetch: fetchBilling };
}

export function useCommunications(caseId: string, patientId: string) {
  const [comments, setComments] = useState<string[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [consentRecords, setConsentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      const [cData, sData, rData] = await Promise.all([
        apiService.getCaseComments(caseId),
        apiService.getSupportMessages(caseId),
        apiService.getConsentRecords(patientId || "11111111-1111-1111-1111-111111111111")
      ]);
      setComments(cData);
      setSupportMessages(sData);
      setConsentRecords(rData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load communications");
    } finally {
      setLoading(false);
    }
  }, [caseId, patientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addComment = async (author: string, text: string) => {
    try {
      const newComment = await apiService.addCaseComment(caseId, author, text);
      setComments(prev => [...prev, newComment]);
      return newComment;
    } catch (err: any) {
      throw new Error(err.message || "Failed to add comment");
    }
  };

  const sendSupport = async (sender: "patient" | "clinic", text: string) => {
    try {
      const newMsg = await apiService.sendSupportMessage(caseId, sender, text);
      setSupportMessages(prev => [...prev, newMsg]);
      return newMsg;
    } catch (err: any) {
      throw new Error(err.message || "Failed to send support message");
    }
  };

  return { comments, supportMessages, consentRecords, loading, error, refetch: fetchAll, addComment, sendSupport };
}
