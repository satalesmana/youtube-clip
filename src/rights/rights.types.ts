/** Rights status for source video and assets in the AI Viral Content Transformer pipeline. */

/** Legal/rights status of the source material and any used assets. */
export type RightsStatus =
  | 'UNKNOWN'        /** belum diverifikasi */
  | 'PENDING'        /** dalam proses review */
  | 'AUTHORIZED'     /** telah diizinkan (manual approval) */
  | 'LICENSED'       /** ada lisensi tertulis */
  | 'CC'             /** Creative Commons */
  | 'PD'             /** Public Domain */
  | 'REJECTED'       /** tidak boleh dipublikasikan */
  | 'EXPIRED';       /** lisensi sudah kadaluarsa */

/** Whether a rights status allows publication. */
export function isPublishable(status: RightsStatus): boolean {
  return ['AUTHORIZED', 'LICENSED', 'CC', 'PD'].includes(status);
}

/** Default rights status for newly processed videos. */
export const DEFAULT_RIGHTS_STATUS: RightsStatus = 'UNKNOWN';

export interface RightsMetadata {
  /** Source video ID or URL. */
  sourceId: string;
  /** YouTube URL of the source video. */
  sourceUrl?: string;
  /** Rights status (default: UNKNOWN). */
  status: RightsStatus;
  /** Who approved and when (if applicable). */
  approvedBy?: string;
  approvedAt?: string;
  /** Reviewer notes. */
  notes?: string;
  /** ISO timestamp when record was created. */
  createdAt: string;
  /** ISO timestamp when record was last updated. */
  updatedAt: string;
}
