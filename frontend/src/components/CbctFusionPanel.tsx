'use client';

import React, { useState, useCallback } from 'react';
import {
  registerCbctScan, listCbctScans, createFusion, listFusions, reviewFusion,
  listBoneSegments, updateSegmentDensity,
  CbctScan, CbctFusion, BoneSegment, FileFormat, RegistrationMethod,
} from '@/lib/api/cbct';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BONE_QUALITY_LABELS: Record<string, string> = {
  D1: 'D1 — Dense cortical (>1250 HU)',
  D2: 'D2 — Thick cortical (850–1250 HU)',
  D3: 'D3 — Thin cortical (350–850 HU)',
  D4: 'D4 — Soft cancellous (<350 HU)',
};

const BONE_QUALITY_COLOR: Record<string, string> = {
  D1: 'text-green-700',
  D2: 'text-teal-700',
  D3: 'text-amber-700',
  D4: 'text-red-700',
};

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  maxilla:     'Maxilla',
  mandible:    'Mandible',
  tooth_root:  'Tooth Root',
  nerve_canal: 'Nerve Canal',
  sinus:       'Maxillary Sinus',
  condyle:     'Condyle',
};

const FILE_FORMATS: Array<{ value: FileFormat; label: string }> = [
  { value: 'dicom',   label: 'DICOM' },
  { value: 'dcm_zip', label: 'DICOM ZIP' },
  { value: 'nifti',   label: 'NIfTI' },
  { value: 'raw',     label: 'Raw Volume' },
];

const REG_METHODS: Array<{ value: RegistrationMethod; label: string }> = [
  { value: 'icp',           label: 'ICP (Iterative Closest Point)' },
  { value: 'surface_match', label: 'Surface Matching' },
  { value: 'landmark',      label: 'Landmark-based' },
  { value: 'manual',        label: 'Manual Alignment' },
];

function qualityBadge(score: number | null): React.ReactNode {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${color}`}>{pct}% quality</span>;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  stlScanId?: string;
}

type TabId = 'scans' | 'fusions' | 'segments';

export default function CbctFusionPanel({ caseId, stlScanId }: Props) {
  const [tab, setTab] = useState<TabId>('scans');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CBCT scans state
  const [scans, setScans] = useState<CbctScan[]>([]);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFormat, setNewFormat] = useState<FileFormat>('dicom');
  const [newOriginalFilename, setNewOriginalFilename] = useState('');
  const [newVoxelSize, setNewVoxelSize] = useState('0.4');
  const [newFov, setNewFov] = useState('120');
  const [newKvp, setNewKvp] = useState('90');
  const [newMa, setNewMa] = useState('8');

  // Fusions state
  const [fusions, setFusions] = useState<CbctFusion[]>([]);
  const [selectedCbctId, setSelectedCbctId] = useState('');
  const [regMethod, setRegMethod] = useState<RegistrationMethod>('icp');

  // Segments state
  const [segments, setSegments] = useState<BoneSegment[]>([]);
  const [selectedFusionId, setSelectedFusionId] = useState('');
  const [editingDensity, setEditingDensity] = useState<Record<string, string>>({});

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'scans',    label: 'CBCT Scans' },
    { id: 'fusions',  label: 'STL Fusions' },
    { id: 'segments', label: 'Bone Segments' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">CBCT Integration</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          CBCT scan import, ICP-based STL fusion, bone segmentation, and density analysis
        </p>
      </div>

      <div className="border-b border-gray-200 flex">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
        )}

        {/* CBCT Scans Tab */}
        {tab === 'scans' && (
          <div className="space-y-4">
            <div className="rounded border border-gray-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-800">Register CBCT Scan</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">File Path</label>
                  <input
                    value={newFilePath}
                    onChange={e => setNewFilePath(e.target.value)}
                    placeholder="/data/cbct/patient_001.dcm"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Original Filename</label>
                  <input
                    value={newOriginalFilename}
                    onChange={e => setNewOriginalFilename(e.target.value)}
                    placeholder="patient_001.dcm"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Format</label>
                  <select
                    value={newFormat}
                    onChange={e => setNewFormat(e.target.value as FileFormat)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                  >
                    {FILE_FORMATS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Voxel Size (mm)</label>
                  <input
                    type="number" step="0.1" value={newVoxelSize}
                    onChange={e => setNewVoxelSize(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">FOV (mm)</label>
                  <input
                    type="number" value={newFov}
                    onChange={e => setNewFov(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">kVp / mA</label>
                  <div className="flex gap-1">
                    <input type="number" value={newKvp} onChange={e => setNewKvp(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5" />
                    <input type="number" value={newMa} onChange={e => setNewMa(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => run(async () => {
                    const scan = await registerCbctScan(caseId, {
                      filePath: newFilePath, fileFormat: newFormat,
                      originalFilename: newOriginalFilename || undefined,
                      voxelSizeMm: parseFloat(newVoxelSize),
                      fovMm: parseFloat(newFov),
                      kvp: parseInt(newKvp, 10), ma: parseInt(newMa, 10),
                    });
                    setScans(prev => [scan, ...prev]);
                    setNewFilePath(''); setNewOriginalFilename('');
                  })}
                  disabled={loading || !newFilePath}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Registering…' : 'Register Scan'}
                </button>
                <button
                  onClick={() => run(async () => setScans(await listCbctScans(caseId)))}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            {scans.map(scan => (
              <div key={scan.id} className="rounded border border-gray-200 p-3 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{scan.originalFilename ?? scan.filePath}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{scan.fileFormat}</span>
                </div>
                <div className="flex gap-4 text-gray-500">
                  {scan.voxelSizeMm != null && <span>Voxel {scan.voxelSizeMm}mm</span>}
                  {scan.fovMm != null && <span>FOV {scan.fovMm}mm</span>}
                  {scan.kvp != null && <span>{scan.kvp}kVp / {scan.ma}mA</span>}
                </div>
                <div className="flex justify-between text-gray-400">
                  <span className="font-mono text-[10px]">{scan.id.slice(0, 12)}…</span>
                  <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fusions Tab */}
        {tab === 'fusions' && (
          <div className="space-y-4">
            <div className="rounded border border-gray-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-800">Create STL Fusion</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">CBCT Scan ID</label>
                  <input
                    value={selectedCbctId}
                    onChange={e => setSelectedCbctId(e.target.value)}
                    placeholder="UUID of CBCT scan"
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Registration Method</label>
                  <select
                    value={regMethod}
                    onChange={e => setRegMethod(e.target.value as RegistrationMethod)}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                  >
                    {REG_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!stlScanId && (
                <p className="text-[10px] text-amber-700">No STL scan ID provided — pass stlScanId prop to enable fusion.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => run(async () => {
                    if (!stlScanId) throw new Error('STL scan ID required');
                    const fusion = await createFusion(caseId, selectedCbctId, stlScanId, regMethod);
                    setFusions(prev => [fusion, ...prev]);
                  })}
                  disabled={loading || !selectedCbctId || !stlScanId}
                  className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Fusing…' : 'Create Fusion'}
                </button>
                <button
                  onClick={() => run(async () => setFusions(await listFusions(caseId)))}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            {fusions.map(fusion => (
              <div key={fusion.id} className="rounded border border-gray-200 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    fusion.status === 'completed' ? 'bg-green-100 text-green-700' :
                    fusion.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{fusion.status}</span>
                  {qualityBadge(fusion.fusionQualityScore)}
                  <span className="text-gray-500 capitalize">{fusion.registrationMethod.replace('_', ' ')}</span>
                  {fusion.clinicianReviewed && (
                    <span className="text-green-700 text-[10px]">Reviewed</span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400">{new Date(fusion.createdAt).toLocaleDateString()}</span>
                </div>
                {fusion.registrationErrorMm != null && (
                  <p className="text-gray-600">
                    Registration error: <span className="font-mono">{fusion.registrationErrorMm.toFixed(3)}mm</span>
                    {fusion.registrationErrorMm < 0.5 && <span className="ml-2 text-green-700">(Excellent)</span>}
                    {fusion.registrationErrorMm >= 0.5 && fusion.registrationErrorMm < 1.0 && <span className="ml-2 text-teal-700">(Good)</span>}
                    {fusion.registrationErrorMm >= 1.0 && <span className="ml-2 text-amber-700">(Review recommended)</span>}
                  </p>
                )}
                <div className="flex gap-2">
                  {!fusion.clinicianReviewed && (
                    <button
                      onClick={() => run(async () => {
                        const updated = await reviewFusion(caseId, fusion.id);
                        setFusions(prev => prev.map(f => f.id === updated.id ? updated : f));
                      })}
                      disabled={loading}
                      className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Mark Reviewed
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedFusionId(fusion.id);
                      setTab('segments');
                      run(async () => setSegments(await listBoneSegments(caseId, fusion.id)));
                    }}
                    disabled={loading}
                    className="px-2 py-1 text-[10px] border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    View Segments
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Segments Tab */}
        {tab === 'segments' && (
          <div className="space-y-4">
            {!selectedFusionId && (
              <p className="text-xs text-gray-400 italic">Select "View Segments" on a fusion to load bone segments.</p>
            )}
            {segments.map(seg => (
              <div key={seg.id} className="rounded border border-gray-200 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">
                    {SEGMENT_TYPE_LABELS[seg.segmentType] ?? seg.segmentType}
                  </span>
                  {seg.fdiNumber != null && (
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">FDI {seg.fdiNumber}</span>
                  )}
                  {seg.boneQuality && (
                    <span className={`text-[10px] font-semibold ${BONE_QUALITY_COLOR[seg.boneQuality] ?? 'text-gray-700'}`}>
                      {seg.boneQuality}
                    </span>
                  )}
                </div>
                {seg.boneQuality && (
                  <p className="text-[10px] text-gray-500">{BONE_QUALITY_LABELS[seg.boneQuality]}</p>
                )}
                <div className="flex gap-4 text-gray-600">
                  {seg.densityHu != null && <span>Density <span className="font-mono">{seg.densityHu} HU</span></span>}
                  {seg.volumeMm3 != null && <span>Volume <span className="font-mono">{seg.volumeMm3.toFixed(0)} mm³</span></span>}
                  {seg.surfaceAreaMm2 != null && <span>Surface <span className="font-mono">{seg.surfaceAreaMm2.toFixed(0)} mm²</span></span>}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Override HU…"
                    value={editingDensity[seg.id] ?? ''}
                    onChange={e => setEditingDensity(prev => ({ ...prev, [seg.id]: e.target.value }))}
                    className="w-28 text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <button
                    onClick={() => run(async () => {
                      const hu = parseFloat(editingDensity[seg.id] ?? '0');
                      if (isNaN(hu)) return;
                      const updated = await updateSegmentDensity(caseId, selectedFusionId, seg.id, hu);
                      setSegments(prev => prev.map(s => s.id === updated.id ? updated : s));
                      setEditingDensity(prev => { const next = { ...prev }; delete next[seg.id]; return next; });
                    })}
                    disabled={loading || !editingDensity[seg.id]}
                    className="px-2 py-1 text-[10px] border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-amber-700">
              Bone density and quality assessments are for treatment planning reference only.
              Radiographic interpretation requires qualified clinical review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
