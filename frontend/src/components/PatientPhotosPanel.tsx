"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, ChevronLeft, ChevronRight, Download, Grid3X3,
  Info, Loader2, Plus, Trash2, X, ZoomIn,
} from "lucide-react";
import {
  type PatientPhoto,
  type PhotoType,
  PHOTO_TYPES,
  PHOTO_TYPE_LABELS,
  PHOTO_GROUPS,
  listPhotos,
  uploadPhoto,
  deletePhoto,
} from "@/lib/api/photos";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Photo Slot (empty or filled) ────────────────────────────────────────────

function PhotoSlot({
  type,
  photo,
  onAdd,
  onDelete,
  onPreview,
}: {
  type: PhotoType;
  photo: PatientPhoto | undefined;
  onAdd: (type: PhotoType) => void;
  onDelete: (id: string) => void;
  onPreview: (photo: PatientPhoto) => void;
}) {
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]">
      {photo ? (
        <>
          {/* Placeholder for image — actual img would need file serving */}
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 bg-[color:var(--card)]">
            <Camera size={20} className="text-[color:var(--muted-foreground)]" />
            <span className="text-[10px] text-[color:var(--muted-foreground)] text-center px-1 leading-tight">
              {photo.originalFilename ?? photo.filePath.split("/").pop()}
            </span>
            <span className="text-[9px] text-[color:var(--muted-foreground)]">{fmtBytes(photo.fileSizeBytes)}</span>
          </div>

          {/* Overlay actions */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onPreview(photo)}
              className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
              title="Preview"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(photo.id)}
              className="rounded-full bg-rose-500/80 p-2 text-white hover:bg-rose-500"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(type)}
          className="h-full w-full flex flex-col items-center justify-center gap-1 text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] transition-colors"
        >
          <Plus size={16} strokeWidth={1.5} />
          <span className="text-[10px] text-center leading-tight px-1">{PHOTO_TYPE_LABELS[type]}</span>
        </button>
      )}

      {/* Type label badge */}
      <div className="absolute bottom-1 left-1 right-1 text-center">
        <span className="inline-block rounded px-1 py-0.5 text-[9px] font-medium leading-none bg-black/40 text-white/90 backdrop-blur-sm">
          {PHOTO_TYPE_LABELS[type]}
        </span>
      </div>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: PatientPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const photo = photos[idx];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx(i => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [photos.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] rounded-xl bg-[color:var(--card)] p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]"
        >
          <X size={16} />
        </button>

        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            {PHOTO_TYPE_LABELS[photo.photoType]}
          </span>
          {photo.takenAt && (
            <span className="text-xs text-[color:var(--muted-foreground)]">
              {new Date(photo.takenAt).toLocaleDateString()}
            </span>
          )}
          <span className="text-xs text-[color:var(--muted-foreground)]">{fmtBytes(photo.fileSizeBytes)}</span>
        </div>

        {/* Image area */}
        <div className="flex h-64 w-96 items-center justify-center rounded-lg bg-[color:var(--muted)]">
          <Camera size={48} className="text-[color:var(--muted-foreground)]" />
        </div>

        {/* Navigation */}
        {photos.length > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="rounded p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[color:var(--muted-foreground)]">{idx + 1} / {photos.length}</span>
            <button
              type="button"
              onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))}
              disabled={idx === photos.length - 1}
              className="rounded p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  caseId,
  initialType,
  onClose,
  onUploaded,
}: {
  caseId: string;
  initialType: PhotoType;
  onClose: () => void;
  onUploaded: (photo: PatientPhoto) => void;
}) {
  const [photoType, setPhotoType] = useState<PhotoType>(initialType);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [takenAt, setTakenAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFileName(f.name); setFileSize(f.size); }
  };

  const handleSubmit = async () => {
    if (!fileName) { setError("Please select a file."); return; }
    setBusy(true); setError("");
    try {
      const photo = await uploadPhoto(caseId, {
        photoType,
        filePath: `cases/${caseId}/photos/${Date.now()}_${fileName}`,
        fileSizeBytes: fileSize,
        originalFilename: fileName,
        takenAt: takenAt ? new Date(takenAt).toISOString() : undefined,
        notes: notes || undefined,
      });
      onUploaded(photo);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[color:var(--card)] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold text-[color:var(--foreground)]">Add Photo</h2>

        <div className="space-y-3">
          {/* Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">Photo Type</label>
            <select
              value={photoType}
              onChange={e => setPhotoType(e.target.value as PhotoType)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            >
              {PHOTO_TYPES.map(t => (
                <option key={t} value={t}>{PHOTO_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* File */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">File</label>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] text-left truncate"
              >
                {fileName || "Choose image file…"}
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">Date taken</label>
            <input
              type="date"
              value={takenAt}
              onChange={e => setTakenAt(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--muted-foreground)]">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !fileName}
            className="flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {busy ? "Saving…" : "Add Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PatientPhotosPanel({ caseId }: { caseId: string }) {
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadType, setUploadType] = useState<PhotoType | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PatientPhoto | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const loadPhotos = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const list = await listPhotos(caseId);
      setPhotos(list);
    } catch (e: any) {
      setError(e.message ?? "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  async function handleDelete(photoId: string) {
    try {
      await deletePhoto(caseId, photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (e: any) {
      alert(e.message ?? "Delete failed");
    }
  }

  function handlePreview(photo: PatientPhoto) {
    setPreviewPhoto(photo);
    setPreviewIdx(photos.findIndex(p => p.id === photo.id));
  }

  const photoByType = Object.fromEntries(photos.map(p => [p.photoType, p])) as Partial<Record<PhotoType, PatientPhoto>>;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[color:var(--muted-foreground)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading photos…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>Photos are stored as references. Clinical photographic records must comply with your organisation's imaging and consent protocols.</span>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-[color:var(--muted-foreground)]" />
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            {photos.length} / {PHOTO_TYPES.length} photos
          </span>
        </div>
        <button
          type="button"
          onClick={() => setUploadType('other')}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)] hover:opacity-90"
        >
          <Plus size={12} />
          Add Photo
        </button>
      </div>

      {/* Groups */}
      {PHOTO_GROUPS.map(group => (
        <section key={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
            {group.label}
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {group.types.map(type => (
              <PhotoSlot
                key={type}
                type={type}
                photo={photoByType[type]}
                onAdd={t => setUploadType(t)}
                onDelete={handleDelete}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Upload modal */}
      {uploadType && (
        <UploadModal
          caseId={caseId}
          initialType={uploadType}
          onClose={() => setUploadType(null)}
          onUploaded={photo => setPhotos(prev => [...prev.filter(p => p.photoType !== photo.photoType), photo])}
        />
      )}

      {/* Lightbox */}
      {previewPhoto && (
        <Lightbox
          photos={photos}
          initialIndex={previewIdx}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </div>
  );
}
