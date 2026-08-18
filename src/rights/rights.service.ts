import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { rightsMetadataSchema } from './rights.schema.js';
import type { RightsMetadata, RightsStatus } from './rights.types.js';
import type { Logger } from '../utils/logger.js';

const RIGHTS_FILENAME = 'rights.json';

/**
 * Filesystem-backed rights gate service.
 *
 * Stores rights metadata per videoId under `outputs/{videoId}/metadata/rights.json`.
 * Default status is UNKNOWN (non-publishable) until manually reviewed.
 */
export class RightsService {
  constructor(private readonly outputsDir: string, private readonly logger: Logger) {}

  /** Load rights metadata for a videoId, or create with default UNKNOWN status. */
  async load(videoId: string): Promise<RightsMetadata> {
    const rightsPath = join(this.outputsDir, videoId, 'metadata', RIGHTS_FILENAME);
    try {
      const raw = await readFile(rightsPath, 'utf8');
      const parsed = JSON.parse(raw);
      const validated = rightsMetadataSchema.parse(parsed);
      return validated;
    } catch {
      // File doesn't exist or invalid — create fresh with UNKNOWN
      this.logger.info({ videoId }, 'Creating new rights record (UNKNOWN)');
      const fresh: RightsMetadata = {
        sourceId: videoId,
        status: 'UNKNOWN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.save(videoId, fresh);
      return fresh;
    }
  }

  /** Save rights metadata to disk. */
  async save(videoId: string, rights: RightsMetadata): Promise<void> {
    const metadataDir = join(this.outputsDir, videoId, 'metadata');
    await mkdir(metadataDir, { recursive: true });
    const rightsPath = join(metadataDir, RIGHTS_FILENAME);
    await writeFile(rightsPath, JSON.stringify(rights, null, 2));
    this.logger.info({ videoId, status: rights.status }, 'Rights metadata saved');
  }

  /** Update rights status (e.g. approve/reject). */
  async updateStatus(
    videoId: string,
    status: RightsStatus,
    opts?: { approvedBy?: string; notes?: string },
  ): Promise<RightsMetadata> {
    const rights = await this.load(videoId);
    const previousStatus = rights.status;
    rights.status = status;
    rights.updatedAt = new Date().toISOString();
    if (opts?.approvedBy) {
      rights.approvedBy = opts.approvedBy;
    }
    if (opts?.notes) {
      rights.notes = opts.notes;
    }
    // Auto-set approvedAt when moving to publishable status
    if (status === 'AUTHORIZED' && !rights.approvedAt) {
      rights.approvedAt = rights.updatedAt;
    }
    await this.save(videoId, rights);
    this.logger.info(
      { videoId, from: previousStatus, to: status, approvedBy: opts?.approvedBy },
      'Rights status updated',
    );
    return rights;
  }

  /** Check if a video is publishable (rights gate). */
  async canPublish(videoId: string): Promise<{ publishable: boolean; status: RightsStatus; reason?: string }> {
    const rights = await this.load(videoId);
    const publishable = RightsService.isPublishable(rights.status);
    return {
      publishable,
      status: rights.status,
      reason: publishable
        ? undefined
        : `Status "${rights.status}" is not publishable. Requires AUTHORIZED, LICENSED, CC, or PD.`,
    };
  }

  /** Check if a rights status allows publication. */
  static isPublishable(status: RightsStatus): boolean {
    return ['AUTHORIZED', 'LICENSED', 'CC', 'PD'].includes(status);
  }
}
