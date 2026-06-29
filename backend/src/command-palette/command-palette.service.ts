import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Command {
  id: string; label: string; category: string; shortcut?: string; description?: string;
}

export interface CommandHistoryEntry {
  commandId: string; commandLabel: string; executedAt: string;
}

const PLATFORM_COMMANDS: Command[] = [
  { id: 'nav.cases',        label: 'Go to Cases',           category: 'navigation',  shortcut: '⌘C' },
  { id: 'nav.patients',     label: 'Go to Patients',        category: 'navigation',  shortcut: 'P' },
  { id: 'nav.dashboard',    label: 'Go to Dashboard',       category: 'navigation',  shortcut: 'H' },
  { id: 'nav.settings',     label: 'Go to Settings',        category: 'navigation',  shortcut: 'S' },
  { id: 'nav.studio',       label: 'Open CAD Studio',       category: 'navigation',  shortcut: '⌘S' },
  { id: 'case.new',         label: 'Create New Case',       category: 'cases',       shortcut: '⌘N' },
  { id: 'case.search',      label: 'Search Cases',          category: 'cases',       shortcut: '⌘F' },
  { id: 'patient.new',      label: 'Add New Patient',       category: 'patients' },
  { id: 'scan.upload',      label: 'Upload Scan',           category: 'scans' },
  { id: 'report.generate',  label: 'Generate Report',       category: 'reports' },
  { id: 'ai.propose',       label: 'Run AI Proposal',       category: 'ai' },
  { id: 'export.package',   label: 'Export Treatment Package', category: 'export' },
  { id: 'theme.toggle',     label: 'Toggle Dark Mode',      category: 'settings' },
  { id: 'consent.new',      label: 'Create Consent Form',   category: 'clinical' },
  { id: 'appt.schedule',    label: 'Schedule Appointment',  category: 'clinical' },
  { id: 'rx.new',           label: 'New Prescription',      category: 'clinical' },
  { id: 'lab.order',        label: 'Create Lab Order',      category: 'clinical' },
  { id: 'bi.dashboard',     label: 'Open BI Dashboard',     category: 'analytics' },
  { id: 'inventory.check',  label: 'Check Inventory Stock', category: 'inventory' },
  { id: 'fhir.export',      label: 'Export FHIR Record',    category: 'interop' },
];

@Injectable()
export class CommandPaletteService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  listCommands(query?: string): Command[] {
    if (!query) return PLATFORM_COMMANDS;
    const q = query.toLowerCase();
    return PLATFORM_COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.description ?? '').toLowerCase().includes(q),
    );
  }

  async recordExecution(orgId: string, userId: string, commandId: string): Promise<void> {
    const cmd = PLATFORM_COMMANDS.find(c => c.id === commandId);
    if (!cmd) return;
    await this.db.query(
      'INSERT INTO command_history (organization_id, user_id, command_id, command_label) VALUES ($1,$2,$3,$4)',
      [orgId, userId, commandId, cmd.label],
    );
  }

  async getFrequentCommands(orgId: string, userId: string, limit = 5): Promise<{ commandId: string; commandLabel: string; count: number }[]> {
    const { rows } = await this.db.query(
      `SELECT command_id, command_label, COUNT(*)::int AS count
       FROM command_history WHERE organization_id=$1 AND user_id=$2
       AND executed_at >= now() - interval '30 days'
       GROUP BY command_id, command_label ORDER BY count DESC LIMIT $3`,
      [orgId, userId, limit],
    );
    return rows.map(r => ({ commandId: r['command_id'] as string, commandLabel: r['command_label'] as string, count: r['count'] as number }));
  }

  async getRecentCommands(orgId: string, userId: string, limit = 10): Promise<CommandHistoryEntry[]> {
    const { rows } = await this.db.query(
      `SELECT command_id, command_label, executed_at FROM command_history
       WHERE organization_id=$1 AND user_id=$2 ORDER BY executed_at DESC LIMIT $3`,
      [orgId, userId, limit],
    );
    return rows.map(r => ({ commandId: r['command_id'] as string, commandLabel: r['command_label'] as string, executedAt: String(r['executed_at']) }));
  }
}
