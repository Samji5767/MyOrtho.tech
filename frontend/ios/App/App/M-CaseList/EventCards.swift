import SwiftUI

// MARK: - Shared card action button

struct CardButton: View {
    let label: String
    let action: () -> Void

    init(_ label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.moCaption2)
                .foregroundStyle(Color.moTeal)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, 5)
                .background(Color.moTealDim, in: Capsule())
        }
    }
}

// MARK: - Scan card

struct ScanCard: View {
    let event: CaseEvent
    @Environment(AppNavigation.self) private var navigation

    private var meta: ScanEventMeta? { event.decodeMeta(ScanEventMeta.self) }

    private var archTitle: String {
        guard let filename = meta?.filename else { return event.kind.displayName }
        let f = filename.lowercased()
        if f.contains("upper")                                              { return "Upper Arch Scan" }
        if f.contains("lower")                                              { return "Lower Arch Scan" }
        if f.contains("buccal") && (f.contains("_1") || f.contains("1.")) { return "Buccal Left Scan" }
        if f.contains("buccal") && (f.contains("_2") || f.contains("2.")) { return "Buccal Right Scan" }
        if f.contains("buccal")                                             { return "Buccal Scan" }
        return "Scan"
    }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Header row
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "cube.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.moBlue)
                        .frame(width: 28, height: 28)
                        .background(Color.moBlueDim,
                                    in: RoundedRectangle(cornerRadius: AppRadius.sm))
                    Text(archTitle)
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Spacer()
                }

                // Filename + triangle count + file size
                if let m = meta {
                    Text(m.filename)
                        .font(.moMono)
                        .foregroundStyle(Color.moTextSecondary)
                        .lineLimit(1)
                    HStack(spacing: AppSpacing.xs) {
                        Text("\(m.triangleCount.formatted()) triangles")
                            .font(.moCaption)
                            .foregroundStyle(Color.moTextTertiary)
                        if let size = fileSizeMB(m.filename) {
                            Text("·").font(.moCaption).foregroundStyle(Color.moTextTertiary)
                            Text(size).font(.moCaption).foregroundStyle(Color.moTextTertiary)
                        }
                    }
                } else if let note = event.note, !note.isEmpty {
                    Text(note)
                        .font(.moCaption)
                        .foregroundStyle(Color.moTextSecondary)
                        .lineLimit(2)
                }

                // Upload date + author
                HStack {
                    Text("Uploaded \(event.timestamp.formatted(date: .abbreviated, time: .omitted))")
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                    Spacer()
                    Text(event.authorName)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                }

                // Actions (only when we have a filename to navigate to)
                if let m = meta {
                    HStack(spacing: AppSpacing.sm) {
                        CardButton("Open in Workspace") { openInWorkspace(m.filename) }
                        CardButton("Segment →")         { openInWorkspace(m.filename) }
                    }
                    .padding(.top, AppSpacing.xs)
                }
            }
            .padding(AppSpacing.md)
            .background(Color.moSurface,
                        in: RoundedRectangle(cornerRadius: AppRadius.md, style: .continuous))

            Spacer(minLength: 48)
        }
        .padding(.bottom, AppSpacing.sm)
    }

    private func openInWorkspace(_ filename: String) {
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Scans")
            .appendingPathComponent(filename)
        navigation.workspaceURLToLoad = url
        navigation.selectedTab = .workspace
    }

    private func fileSizeMB(_ filename: String) -> String? {
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Scans")
            .appendingPathComponent(filename)
        guard let bytes = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              bytes > 0 else { return nil }
        return String(format: "%.1f MB", Double(bytes) / 1_048_576)
    }
}

// MARK: - Segmentation card

struct SegmentationCard: View {
    let event: CaseEvent
    @Environment(AppNavigation.self) private var navigation

    private var meta: SegmentationEventMeta? { event.decodeMeta(SegmentationEventMeta.self) }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Header
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.moSegmentation)
                        .frame(width: 28, height: 28)
                        .background(Color.moSegmentation.opacity(0.15),
                                    in: RoundedRectangle(cornerRadius: AppRadius.sm))
                    Text("AI Segmentation")
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Text("Demo")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.moTextTertiary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.moSurfaceElevated, in: Capsule())
                    Spacer()
                    if let status = event.status {
                        EventStatusBadge(status: status)
                    }
                }

                if let m = meta {
                    // Teeth count + confidence
                    HStack(spacing: AppSpacing.xs) {
                        Text("\(m.teethDetected) teeth detected")
                            .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        Text("·").font(.moCaption).foregroundStyle(Color.moTextTertiary)
                        Text("\(Int(m.confidence * 100))% confident")
                            .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                    }
                    // Approval breakdown
                    HStack(spacing: AppSpacing.md) {
                        Label("\(m.approved) approved",
                              systemImage: "checkmark.circle.fill")
                            .font(.moCaption).foregroundStyle(Color.moApproved)
                        Label("\(m.pending) pending",
                              systemImage: "exclamationmark.circle.fill")
                            .font(.moCaption).foregroundStyle(Color.moPending)
                    }
                } else if let note = event.note, !note.isEmpty {
                    Text(note)
                        .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        .lineLimit(2)
                }

                HStack {
                    Text(event.timestamp, style: .relative)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                    Spacer()
                    Text(event.authorName)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                }

                HStack {
                    CardButton("Review in Workspace") { navigation.selectedTab = .workspace }
                }
                .padding(.top, AppSpacing.xs)
            }
            .padding(AppSpacing.md)
            .background(Color.moSurface,
                        in: RoundedRectangle(cornerRadius: AppRadius.md, style: .continuous))

            Spacer(minLength: 48)
        }
        .padding(.bottom, AppSpacing.sm)
    }
}

// MARK: - Treatment plan card

struct TreatmentPlanCard: View {
    let event: CaseEvent
    var onSendToMfg: (() -> Void)? = nil

    private var meta: TreatmentPlanEventMeta? { event.decodeMeta(TreatmentPlanEventMeta.self) }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Header
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "list.clipboard.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.moApproved)
                        .frame(width: 28, height: 28)
                        .background(Color.moApproved.opacity(0.15),
                                    in: RoundedRectangle(cornerRadius: AppRadius.sm))
                    Text(meta.map { "Treatment Plan v\($0.version)" } ?? "Treatment Plan")
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Spacer()
                    if let status = event.status {
                        EventStatusBadge(status: status)
                    }
                }

                if let m = meta {
                    HStack(spacing: AppSpacing.xs) {
                        Text("\(m.stageCount) stages")
                            .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        if let months = m.durationMonths {
                            Text("·").font(.moCaption).foregroundStyle(Color.moTextTertiary)
                            Text("~\(months) months")
                                .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        }
                    }
                } else if let note = event.note, !note.isEmpty {
                    Text(note)
                        .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        .lineLimit(2)
                }

                HStack {
                    Text(event.timestamp, style: .relative)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                    Spacer()
                    Text(event.authorName)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                }

                HStack(spacing: AppSpacing.sm) {
                    CardButton("View Plan") {}
                    if let mfg = onSendToMfg {
                        CardButton("Send to Mfg →", action: mfg)
                    }
                }
                .padding(.top, AppSpacing.xs)
            }
            .padding(AppSpacing.md)
            .background(Color.moSurface,
                        in: RoundedRectangle(cornerRadius: AppRadius.md, style: .continuous))

            Spacer(minLength: 48)
        }
        .padding(.bottom, AppSpacing.sm)
    }
}

// MARK: - Manufacturing card

struct ManufacturingCard: View {
    let event: CaseEvent

    private var meta: ManufacturingEventMeta? { event.decodeMeta(ManufacturingEventMeta.self) }

    // Maps EventStatus → 0.0–1.0 along the production pipeline
    private var progressValue: Double {
        switch event.status {
        case .queued:     return 1.0 / 7.0
        case .processing: return 2.0 / 7.0
        case .printing:   return 3.0 / 7.0
        case .qc:         return 4.0 / 7.0
        case .finishing:  return 5.0 / 7.0
        case .shipped:    return 6.0 / 7.0
        case .delivered:  return 1.0
        default:          return 0
        }
    }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Header
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "gearshape.2.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.moManufacturing)
                        .frame(width: 28, height: 28)
                        .background(Color.moManufacturing.opacity(0.15),
                                    in: RoundedRectangle(cornerRadius: AppRadius.sm))
                    Text(meta.map { "Mfg — \($0.vendor)" } ?? "Manufacturing")
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Spacer()
                    if let status = event.status {
                        EventStatusBadge(status: status)
                    }
                }

                // Aligner count + material
                if let m = meta {
                    let countPart = m.stageCount > 0 ? "\(m.stageCount) aligners · " : ""
                    Text("\(countPart)\(m.material)")
                        .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                } else if let note = event.note, !note.isEmpty {
                    Text(note)
                        .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        .lineLimit(2)
                }

                // Production progress bar
                if progressValue > 0 {
                    ProgressView(value: progressValue)
                        .progressViewStyle(.linear)
                        .tint(Color.moManufacturing)
                }

                // ETA + tracking ref
                if let m = meta, m.etaDays != nil || m.trackingRef != nil || m.orderRef != nil {
                    HStack(spacing: AppSpacing.xs) {
                        if let days = m.etaDays, days > 0 {
                            Text("ETA: \(days) day\(days == 1 ? "" : "s")")
                                .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        }
                        if let ref = m.trackingRef ?? m.orderRef {
                            if m.etaDays != nil {
                                Text("·").font(.moCaption).foregroundStyle(Color.moTextTertiary)
                            }
                            Text("Ref: \(ref)")
                                .font(.moCaption).foregroundStyle(Color.moTextSecondary)
                        }
                    }
                }

                HStack {
                    Text(event.timestamp, style: .relative)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                    Spacer()
                    Text(event.authorName)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                }

                HStack {
                    CardButton("Track Order") {}
                }
                .padding(.top, AppSpacing.xs)
            }
            .padding(AppSpacing.md)
            .background(Color.moSurface,
                        in: RoundedRectangle(cornerRadius: AppRadius.md, style: .continuous))

            Spacer(minLength: 48)
        }
        .padding(.bottom, AppSpacing.sm)
    }
}

// MARK: - Appointment card

struct AppointmentCard: View {
    let event: CaseEvent

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Header
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "calendar")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.moPending)
                        .frame(width: 28, height: 28)
                        .background(Color.moPending.opacity(0.15),
                                    in: RoundedRectangle(cornerRadius: AppRadius.sm))
                    Text("Appointment")
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Spacer()
                    if let status = event.status {
                        EventStatusBadge(status: status)
                    }
                }

                // Scheduled date/time from the model's dedicated scheduledAt field
                if let scheduledAt = event.scheduledAt {
                    Text(scheduledAt.formatted(date: .complete, time: .shortened))
                        .font(.moBodyMedium)
                        .foregroundStyle(Color.moTextPrimary)
                }

                if let note = event.note, !note.isEmpty {
                    Text(note)
                        .font(.moCaption)
                        .foregroundStyle(Color.moTextSecondary)
                        .lineLimit(2)
                }

                HStack {
                    Text(event.timestamp, style: .relative)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                    Spacer()
                    Text(event.authorName)
                        .font(.moCaption).foregroundStyle(Color.moTextTertiary)
                }
            }
            .padding(AppSpacing.md)
            .background(Color.moSurface,
                        in: RoundedRectangle(cornerRadius: AppRadius.md, style: .continuous))

            Spacer(minLength: 48)
        }
        .padding(.bottom, AppSpacing.sm)
    }
}
