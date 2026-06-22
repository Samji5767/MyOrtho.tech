import Foundation
import SwiftData

enum SeedData {
    private static let seedKey = "clinical_seed_v3"

    @MainActor
    static func populateIfNeeded(store: CaseEventStore) throws {
        guard !UserDefaults.standard.bool(forKey: seedKey) else { return }

        let cal = Calendar.current
        let now = Date.now

        func daysAgo(_ n: Int) -> Date {
            cal.date(byAdding: .day, value: -n, to: now) ?? now
        }
        func daysFromNow(_ n: Int) -> Date {
            cal.date(byAdding: .day, value: n, to: now) ?? now
        }

        // ─── Cases (3 patients, 5 cases) ──────────────────────────────────────
        let priya = ClinicalCase(
            patientName: "Priya Sharma",
            patientID:   "ORT-001",
            state:       .inManufacturing,
            caseType:    .aligner,
            contactInfo: "+91 98765 43210",
            startDate:   daysAgo(30),
            notes:       "Moderate crowding upper arch. 12-stage aligner plan approved.",
            createdAt:   daysAgo(30)
        )
        let rahul = ClinicalCase(
            patientName: "Rahul Mehta",
            patientID:   "ORT-002",
            state:       .active,
            caseType:    .braces,
            contactInfo: "+91 91234 56789",
            startDate:   daysAgo(20),
            createdAt:   daysAgo(20)
        )
        let anjali = ClinicalCase(
            patientName: "Anjali Nair",
            patientID:   "ORT-003",
            state:       .inProgress,
            caseType:    .aligner,
            contactInfo: "+91 87654 32109",
            startDate:   daysAgo(15),
            createdAt:   daysAgo(15)
        )
        let rahulRetainer = ClinicalCase(
            patientName: "Rahul Mehta",
            patientID:   "ORT-002-R",
            state:       .complete,
            caseType:    .retainer,
            caseStatus:  .completed,
            contactInfo: "+91 91234 56789",
            startDate:   daysAgo(90),
            createdAt:   daysAgo(90)
        )
        let anjaliConsult = ClinicalCase(
            patientName: "Anjali Nair",
            patientID:   "ORT-003-C",
            state:       .active,
            caseType:    .consultation,
            contactInfo: "+91 87654 32109",
            startDate:   daysAgo(5),
            createdAt:   daysAgo(5)
        )

        for c in [priya, rahul, anjali, rahulRetainer, anjaliConsult] {
            try store.insertCase(c)
        }

        // ─── Priya Sharma — Aligner case, in manufacturing ────────────────────

        let priyaScan = CaseEvent(kind: .scan, timestamp: daysAgo(28),
                                  note: "Upper + lower arch scans imported")
        priyaScan.encodeMeta(ScanEventMeta(filename: "orthodontics_355_upper.stl",
                                           triangleCount: 317_425))
        try store.append(priyaScan, to: priya)

        let priyaSeg = CaseEvent(kind: .segmentation, timestamp: daysAgo(27),
                                 status: .complete,
                                 note: "14 teeth detected, confidence 94%")
        priyaSeg.encodeMeta(SegmentationEventMeta(teethDetected: 14, confidence: 0.94,
                                                  approved: 12, pending: 2))
        try store.append(priyaSeg, to: priya)

        let priyaPlan = CaseEvent(kind: .treatmentPlan, timestamp: daysAgo(25),
                                  status: .complete,
                                  note: "12 aligner stages approved by Dr. Sharma")
        priyaPlan.encodeMeta(TreatmentPlanEventMeta(version: 1, stageCount: 12, durationMonths: 6))
        try store.append(priyaPlan, to: priya)

        let priyaMfg1 = CaseEvent(kind: .manufacturing, timestamp: daysAgo(10),
                                   status: .printing,
                                   note: "Stages 1–6 sent to Spring Ray")
        priyaMfg1.encodeMeta(ManufacturingEventMeta(vendor: "Spring Ray", stageCount: 6,
                                                     material: "Clear 0.75mm", etaDays: 7,
                                                     trackingRef: "SR-2026-8821"))
        try store.append(priyaMfg1, to: priya)

        let priyaMfg2 = CaseEvent(kind: .manufacturing, timestamp: daysAgo(3),
                                   status: .qc,
                                   note: "QC inspection in progress")
        priyaMfg2.encodeMeta(ManufacturingEventMeta(vendor: "Spring Ray", stageCount: 6,
                                                     material: "Clear 0.75mm", etaDays: 3,
                                                     orderRef: "SR-2026-8821"))
        try store.append(priyaMfg2, to: priya)

        // ─── Rahul Mehta — Braces case, just started ──────────────────────────
        try store.append(CaseEvent(kind: .note, timestamp: daysAgo(19),
                                   note: "Moderate crowding lower arch. Patient cooperative."),
                         to: rahul)

        let rahulScan = CaseEvent(kind: .scan, timestamp: daysAgo(18),
                                   note: "Full arch panoramic scan")
        rahulScan.encodeMeta(ScanEventMeta(filename: "orthodontics_355_lower.stl",
                                            triangleCount: 250_959))
        try store.append(rahulScan, to: rahul)

        try store.append(CaseEvent(kind: .appointment, timestamp: daysAgo(18),
                                   scheduledAt: daysFromNow(2), status: .scheduled,
                                   note: "Initial treatment planning review"),
                         to: rahul)

        // ─── Anjali Nair — Aligner case, scan pending segmentation ───────────
        let anjaliScan = CaseEvent(kind: .scan, timestamp: daysAgo(14),
                                    note: "Lower arch scan imported")
        anjaliScan.encodeMeta(ScanEventMeta(filename: "orthodontics_355_lower.stl",
                                             triangleCount: 250_959))
        try store.append(anjaliScan, to: anjali)

        try store.append(CaseEvent(kind: .segmentation, timestamp: daysAgo(13),
                                   status: .queued, note: "Awaiting segmentation"),
                         to: anjali)

        try store.append(CaseEvent(kind: .note, timestamp: daysAgo(5),
                                   note: "Patient prefers morning appointments."),
                         to: anjali)

        // ─── Rahul Mehta — Retainer case, complete ───────────────────────────
        try store.append(CaseEvent(kind: .systemEvent, timestamp: daysAgo(85),
                                   note: "Case created"),
                         to: rahulRetainer)

        let retainerMfg = CaseEvent(kind: .manufacturing, timestamp: daysAgo(60),
                                     status: .delivered,
                                     note: "Hawley retainer delivered, fitting successful")
        retainerMfg.encodeMeta(ManufacturingEventMeta(vendor: "In-House", stageCount: 1,
                                                       material: "Hawley Retainer"))
        try store.append(retainerMfg, to: rahulRetainer)

        // ─── Anjali Nair — Consultation ───────────────────────────────────────
        try store.append(CaseEvent(kind: .appointment, timestamp: daysAgo(5),
                                   scheduledAt: daysFromNow(1), status: .scheduled,
                                   note: "Crowding assessment consultation"),
                         to: anjaliConsult)

        UserDefaults.standard.set(true, forKey: seedKey)
    }
}
