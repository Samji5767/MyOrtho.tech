'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface LabOrderItem { id: string; itemType: string; description: string; quantity: number; specifications: Record<string, unknown> }
interface Revision { id: string; reason: string; requestedAt: string }
interface LabOrder {
  id: string;
  orderNumber: string;
  labName: string;
  orderType: string;
  status: string;
  dueDate: string | null;
  priority: string;
  notes: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  items: LabOrderItem[];
  revisions: Revision[];
}

const API = (path: string) => `/api/${path}`;
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API(path), { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

const STATUS_COLOR: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-600',
  submitted:  'bg-blue-100 text-blue-800',
  in_progress:'bg-amber-100 text-amber-800',
  completed:  'bg-green-100 text-green-800',
  cancelled:  'bg-red-100 text-red-800',
  revision_requested: 'bg-purple-100 text-purple-800',
};

const PRIORITY_COLOR: Record<string, string> = {
  routine: 'text-gray-500',
  urgent:  'text-amber-600',
  stat:    'text-red-600 font-bold',
};

const ORDER_TYPES = ['aligner_fabrication','retainer','appliance','model','other'];

export default function LabOrdersPanel({ caseId }: { caseId: string }) {
  const [orders, setOrders]             = useState<LabOrder[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [revisionId, setRevisionId]     = useState<string | null>(null);
  const [revReason, setRevReason]       = useState('');

  // New order form
  const [showCreate, setShowCreate]     = useState(false);
  const [labName, setLabName]           = useState('');
  const [orderType, setOrderType]       = useState('aligner_fabrication');
  const [priority, setPriority]         = useState('routine');
  const [dueDate, setDueDate]           = useState('');
  const [notes, setNotes]               = useState('');

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(() => run(async () => {
    const data = await apiFetch<LabOrder[]>(`cases/${caseId}/lab-orders`);
    setOrders(data);
  }), [caseId, run]);

  useEffect(() => { load(); }, [load]);

  const createOrder = async () => {
    if (!labName.trim()) return;
    await run(async () => {
      await apiFetch(`cases/${caseId}/lab-orders`, {
        method: 'POST',
        body: JSON.stringify({ labName: labName.trim(), orderType, priority, dueDate: dueDate || null, notes: notes || null }),
      });
      setShowCreate(false); setLabName(''); setOrderType('aligner_fabrication'); setPriority('routine'); setDueDate(''); setNotes('');
      await load();
    });
  };

  const submitOrder = async (orderId: string) => {
    await run(async () => {
      await apiFetch(`lab-orders/${orderId}/submit`, { method: 'POST', body: '{}' });
      await load();
    });
  };

  const updateStatus = async (orderId: string, status: string) => {
    await run(async () => {
      await apiFetch(`lab-orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    });
  };

  const requestRevision = async () => {
    if (!revisionId || !revReason.trim()) return;
    await run(async () => {
      await apiFetch(`lab-orders/${revisionId}/revisions`, {
        method: 'POST',
        body: JSON.stringify({ reason: revReason.trim() }),
      });
      setRevisionId(null); setRevReason('');
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Lab Orders</h3>
        <button onClick={() => setShowCreate(v => !v)} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ New Order</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {showCreate && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
          <input type="text" placeholder="Lab name" value={labName} onChange={e => setLabName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={orderType} onChange={e => setOrderType(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              {ORDER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-xs">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="Due date (optional)" className="w-full rounded border border-gray-300 px-3 py-2 text-xs" />
          <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={createOrder} disabled={loading} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {revisionId && (
        <div className="rounded border border-purple-200 bg-purple-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Request Revision</p>
          <textarea placeholder="Reason for revision" value={revReason} onChange={e => setRevReason(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-xs resize-none" />
          <div className="flex gap-2">
            <button onClick={requestRevision} disabled={loading || !revReason.trim()} className="rounded bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Submit Revision</button>
            <button onClick={() => { setRevisionId(null); setRevReason(''); }} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {orders.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-gray-400">No lab orders for this case.</p>
        )}
        {orders.map(o => (
          <div key={o.id} className="rounded border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{o.orderNumber}</p>
                  <span className={`text-[10px] uppercase ${PRIORITY_COLOR[o.priority] ?? ''}`}>{o.priority}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{o.labName} · {o.orderType.replace(/_/g, ' ')}</p>
                {o.dueDate && <p className="text-[10px] text-gray-400 mt-0.5">Due {new Date(o.dueDate).toLocaleDateString()}</p>}
                {o.revisions.length > 0 && <p className="text-[10px] text-purple-600 mt-0.5">{o.revisions.length} revision(s) requested</p>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status.replace(/_/g, ' ')}</span>
                <div className="flex gap-1">
                  <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="text-[10px] text-blue-600 underline">
                    {expanded === o.id ? 'Collapse' : 'Details'}
                  </button>
                  {o.status === 'draft' && (
                    <button onClick={() => submitOrder(o.id)} disabled={loading} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Submit</button>
                  )}
                  {o.status === 'submitted' && (
                    <button onClick={() => updateStatus(o.id, 'in_progress')} disabled={loading} className="rounded bg-amber-500 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">In Progress</button>
                  )}
                  {o.status === 'in_progress' && (
                    <>
                      <button onClick={() => updateStatus(o.id, 'completed')} disabled={loading} className="rounded bg-green-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50">Complete</button>
                      <button onClick={() => setRevisionId(o.id)} className="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">Revision</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {expanded === o.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
                {o.notes && <p className="text-xs text-gray-600 italic">{o.notes}</p>}
                {o.items.length === 0 ? (
                  <p className="text-xs text-gray-400">No line items.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-[10px] text-gray-500"><th className="pb-1">Item</th><th className="pb-1">Description</th><th className="pb-1 text-right">Qty</th></tr></thead>
                    <tbody>
                      {o.items.map(i => (
                        <tr key={i.id} className="border-t border-gray-100">
                          <td className="py-1 text-gray-700">{i.itemType.replace(/_/g, ' ')}</td>
                          <td className="py-1 text-gray-500">{i.description}</td>
                          <td className="py-1 text-right text-gray-700">{i.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
