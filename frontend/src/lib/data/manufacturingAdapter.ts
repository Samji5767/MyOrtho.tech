import type { Printer, PrintJob } from "@/types";
import { apiService } from "@/services/api";

// TODO: Replace with direct Supabase/manufacturing API calls once backend is configured

export async function getManufacturingJobs(): Promise<PrintJob[]> {
  try {
    return await apiService.getPrintJobs();
  } catch {
    return [];
  }
}

export async function getPrinters(): Promise<Printer[]> {
  try {
    return await apiService.getPrinters();
  } catch {
    return [];
  }
}
