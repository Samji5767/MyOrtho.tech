"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PlatformHealthPanel = dynamic(
  () => import("@/components/PlatformHealthPanel"),
  { ssr: false, loading: () => <p className="text-sm text-gray-500">Loading platform health…</p> },
);
const DeviceTrackingPanel = dynamic(
  () => import("@/components/DeviceTrackingPanel"),
  { ssr: false },
);
const RevenueCyclePanel = dynamic(
  () => import("@/components/RevenueCyclePanel"),
  { ssr: false },
);
const IntakeFormsPanel = dynamic(
  () => import("@/components/IntakeFormsPanel"),
  { ssr: false },
);

export default function PlatformHealthPage() {
  return (
    <section className="mx-auto max-w-4xl pb-20 px-4 sm:px-5 pt-4 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Health</h1>
          <p className="text-sm text-gray-500">100-phase clinical operating system status</p>
        </div>
      </div>

      <div className="border rounded-xl bg-white p-5 sm:p-6">
        <PlatformHealthPanel token="" />
      </div>

      <div className="border rounded-xl bg-white p-5 sm:p-6">
        <RevenueCyclePanel token="" />
      </div>

      <div className="border rounded-xl bg-white p-5 sm:p-6">
        <DeviceTrackingPanel token="" />
      </div>

      <div className="border rounded-xl bg-white p-5 sm:p-6">
        <IntakeFormsPanel token="" />
      </div>
    </section>
  );
}
