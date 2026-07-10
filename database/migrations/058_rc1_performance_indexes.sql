-- RC1 performance indexes: covering the highest-impact missing indexes identified
-- during the production-validation audit.

-- segmentation_results: used in case-level queries and scan-level lookups
CREATE INDEX IF NOT EXISTS idx_segmentation_results_case_id
  ON segmentation_results(case_id);

CREATE INDEX IF NOT EXISTS idx_segmentation_results_scan_id
  ON segmentation_results(scan_id);

-- appointments: patient scheduling queries and dentist workload views
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id
  ON appointments(patient_id);

CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id
  ON appointments(dentist_id);

-- legal_consent_records: patient consent lookup
CREATE INDEX IF NOT EXISTS idx_legal_consent_records_patient_id
  ON legal_consent_records(patient_id);
