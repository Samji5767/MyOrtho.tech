"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Plus, Pencil, X, Check, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastContext";
import { Button, Card, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";
import {
  listLocations,
  createLocation,
  updateLocation,
  type OrgLocation,
  type CreateLocationDto,
  type UpdateLocationDto,
} from "@/lib/api/org-locations";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["admin", "super_admin"];

const US_TIMEZONES = [
  { value: "America/New_York",    label: "Eastern Time (ET)" },
  { value: "America/Chicago",     label: "Central Time (CT)" },
  { value: "America/Denver",      label: "Mountain Time (MT)" },
  { value: "America/Phoenix",     label: "Mountain Time – Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage",   label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time (HT)" },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface LocationFormState {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  isPrimary: boolean;
}

const DEFAULT_FORM: LocationFormState = {
  name: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  phone: "",
  email: "",
  timezone: "America/New_York",
  isPrimary: false,
};

function locationToForm(loc: OrgLocation): LocationFormState {
  return {
    name: loc.name,
    addressLine1: loc.addressLine1 ?? "",
    city: loc.city ?? "",
    state: loc.state ?? "",
    postalCode: loc.postalCode ?? "",
    country: loc.country ?? "US",
    phone: loc.phone ?? "",
    email: loc.email ?? "",
    timezone: loc.timezone ?? "America/New_York",
    isPrimary: loc.isPrimary,
  };
}

function formToDto(form: LocationFormState): CreateLocationDto {
  return {
    name: form.name.trim(),
    addressLine1: form.addressLine1.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim() || null,
    country: form.country.trim() || "US",
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    timezone: form.timezone,
    isPrimary: form.isPrimary,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LocationsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading locations">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-3"
        >
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
          <div className="flex gap-2 pt-1">
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inline location form ─────────────────────────────────────────────────────

interface LocationFormProps {
  initial?: LocationFormState;
  saving: boolean;
  onSubmit: (data: LocationFormState) => void;
  onCancel: () => void;
  submitLabel: string;
}

function LocationForm({ initial = DEFAULT_FORM, saving, onSubmit, onCancel, submitLabel }: LocationFormProps) {
  const [form, setForm] = useState<LocationFormState>(initial);
  const [nameError, setNameError] = useState<string | null>(null);

  const set = (field: keyof LocationFormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError("Location name is required.");
      return;
    }
    setNameError(null);
    onSubmit(form);
  };

  const inputCls =
    "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]/30 transition";

  const labelCls = "block text-xs font-semibold text-[color:var(--muted-foreground)] mb-1";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => { set("name", e.target.value); setNameError(null); }}
            placeholder="Main Clinic"
            className={inputCls}
            autoFocus
          />
          {nameError && <p className="mt-1 text-xs text-rose-600">{nameError}</p>}
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Address</label>
          <input
            type="text"
            value={form.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
            placeholder="123 Main St"
            className={inputCls}
          />
        </div>

        {/* City */}
        <div>
          <label className={labelCls}>City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="New York"
            className={inputCls}
          />
        </div>

        {/* State */}
        <div>
          <label className={labelCls}>State</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            placeholder="NY"
            className={inputCls}
          />
        </div>

        {/* Postal code */}
        <div>
          <label className={labelCls}>Postal Code</label>
          <input
            type="text"
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder="10001"
            className={inputCls}
          />
        </div>

        {/* Country */}
        <div>
          <label className={labelCls}>Country</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="US"
            className={inputCls}
          />
        </div>

        {/* Phone */}
        <div>
          <label className={labelCls}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (212) 555-0100"
            className={inputCls}
          />
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="clinic@example.com"
            className={inputCls}
          />
        </div>

        {/* Timezone */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputCls + " appearance-none"}
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Primary checkbox */}
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="isPrimary"
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => set("isPrimary", e.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--primary)]"
          />
          <label htmlFor="isPrimary" className="text-sm text-[color:var(--foreground)] cursor-pointer select-none">
            Set as primary location
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <Check size={14} aria-hidden />
              {submitLabel}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 disabled:opacity-50 transition-colors"
        >
          <X size={14} aria-hidden />
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Location card ────────────────────────────────────────────────────────────

interface LocationCardProps {
  location: OrgLocation;
  onEdit: (loc: OrgLocation) => void;
  onToggleActive: (loc: OrgLocation) => void;
  toggling: boolean;
}

function LocationCard({ location, onEdit, onToggleActive, toggling }: LocationCardProps) {
  const addressParts = [
    location.addressLine1,
    [location.city, location.state].filter(Boolean).join(", "),
    location.postalCode,
  ].filter(Boolean);

  const timezoneLabel =
    US_TIMEZONES.find((tz) => tz.value === location.timezone)?.label ?? location.timezone;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-[color:var(--foreground)] leading-tight">{location.name}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {location.isPrimary && (
            <StatusBadge tone="primary">Primary</StatusBadge>
          )}
          <StatusBadge tone={location.active ? "success" : "neutral"}>
            {location.active ? "Active" : "Inactive"}
          </StatusBadge>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-sm text-[color:var(--muted-foreground)]">
        {addressParts.length > 0 && (
          <div className="flex items-start gap-1.5">
            <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>{addressParts.join(", ")}{location.country && location.country !== "US" ? `, ${location.country}` : ""}</span>
          </div>
        )}
        {location.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="shrink-0" aria-hidden />
            <span>{location.phone}</span>
          </div>
        )}
        {location.email && (
          <div className="flex items-center gap-1.5">
            <Mail size={13} className="shrink-0" aria-hidden />
            <span className="truncate">{location.email}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Globe size={13} className="shrink-0" aria-hidden />
          <span>{timezoneLabel}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onEdit(location)}
          className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
        >
          <Pencil size={12} aria-hidden />
          Edit
        </button>
        <button
          onClick={() => onToggleActive(location)}
          disabled={toggling}
          className={[
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50",
            location.active
              ? "border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800/40 dark:text-rose-400 dark:hover:bg-rose-900/10"
              : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-900/10",
          ].join(" ")}
        >
          {location.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLocationsPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // "add" form visibility
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // which location id is being edited inline (null = none)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // which location id is being toggled (active state)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "loading") return;
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listLocations(false);
      setLocations(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading" || !user || !ADMIN_ROLES.includes(user.role)) return;
    void loadLocations();
  }, [status, user, loadLocations]);

  // ── Add location ──────────────────────────────────────────────────────────

  const handleAdd = async (formData: LocationFormState) => {
    setAddSaving(true);
    try {
      const created = await createLocation(formToDto(formData));
      setLocations((prev) => [...prev, created]);
      setShowAddForm(false);
      toast({ title: "Location added", description: `"${created.name}" has been created.`, type: "success" });
    } catch (err) {
      toast({ title: "Failed to add location", description: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit location ─────────────────────────────────────────────────────────

  const handleEdit = async (id: string, formData: LocationFormState) => {
    setEditSaving(true);
    try {
      const dto: UpdateLocationDto = formToDto(formData);
      const updated = await updateLocation(id, dto);
      setLocations((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingId(null);
      toast({ title: "Location updated", description: `"${updated.name}" has been saved.`, type: "success" });
    } catch (err) {
      toast({ title: "Failed to update location", description: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggleActive = async (loc: OrgLocation) => {
    setTogglingId(loc.id);
    try {
      const updated = await updateLocation(loc.id, { active: !loc.active });
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? updated : l)));
      toast({
        title: updated.active ? "Location activated" : "Location deactivated",
        description: `"${updated.name}" is now ${updated.active ? "active" : "inactive"}.`,
        type: "success",
      });
    } catch (err) {
      toast({ title: "Failed to update location", description: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────

  if (status === "loading" || !user || !ADMIN_ROLES.includes(user.role)) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back navigation + header */}
      <div className="mb-6 flex items-start gap-3">
        <Link
          href="/admin"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to Admin"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[color:var(--foreground)]">Clinic Locations</h1>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">Manage your practice locations</p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => { setShowAddForm(true); setEditingId(null); }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all"
              >
                <Plus size={15} aria-hidden />
                Add Location
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add location inline form */}
      {showAddForm && (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-[color:var(--primary)]" aria-hidden />
            <h2 className="text-base font-semibold text-[color:var(--foreground)]">New Location</h2>
          </div>
          <LocationForm
            saving={addSaving}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Add Location"
          />
        </Card>
      )}

      {/* Error state */}
      {loadError && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <span className="flex-1">{loadError}</span>
          <button
            onClick={() => void loadLocations()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100/60 dark:border-rose-700/40 dark:hover:bg-rose-900/20 transition-colors"
          >
            <RefreshCw size={12} aria-hidden />
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <LocationsSkeleton />}

      {/* Locations grid */}
      {!loading && !loadError && locations.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--border)] bg-slate-50/70 py-16 text-center dark:bg-slate-950/30">
          <Building2 size={28} className="text-[color:var(--primary)]" aria-hidden />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">No locations yet</p>
          <p className="max-w-xs text-sm text-[color:var(--muted-foreground)]">
            Add your first practice location to get started.
          </p>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all"
            >
              <Plus size={14} aria-hidden />
              Add Location
            </button>
          )}
        </div>
      )}

      {!loading && locations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) =>
            editingId === loc.id ? (
              // Inline edit form replaces card
              <div
                key={loc.id}
                className="rounded-xl border border-[color:var(--primary)]/40 bg-[color:var(--card)] p-5 sm:col-span-2 lg:col-span-3"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil size={15} className="text-[color:var(--primary)]" aria-hidden />
                    <h2 className="text-base font-semibold text-[color:var(--foreground)]">Edit: {loc.name}</h2>
                  </div>
                  <button
                    onClick={() => setEditingId(null)}
                    aria-label="Close edit form"
                    className="rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
                <LocationForm
                  initial={locationToForm(loc)}
                  saving={editSaving}
                  onSubmit={(data) => void handleEdit(loc.id, data)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save Changes"
                />
              </div>
            ) : (
              <LocationCard
                key={loc.id}
                location={loc}
                onEdit={(l) => { setEditingId(l.id); setShowAddForm(false); }}
                onToggleActive={(l) => void handleToggleActive(l)}
                toggling={togglingId === loc.id}
              />
            )
          )}
        </div>
      )}

      {/* Footer count */}
      {!loading && locations.length > 0 && (
        <p className="mt-5 text-xs text-[color:var(--muted-foreground)]">
          {locations.filter((l) => l.active).length} active · {locations.length} total location{locations.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
