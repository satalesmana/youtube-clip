import { z } from 'zod';

/** Schema for word timestamp in transcript segment */
export const wordTimestampSchema = z.object({
  word: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});

/** Schema for a transcript segment */
export const transcriptSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
  words: z.array(wordTimestampSchema).optional(),
});

/** Request schema for `GET /api/transcript` */
export const transcriptGetQuerySchema = z.object({
  youtubeUrl: z.string().optional(),
  videoId: z.string().optional(),
  sttProvider: z.enum(['faster-whisper', 'whisper-cpp', 'whisperx', 'openai']).optional(),
  force: z.coerce.boolean().optional().default(false),
}).refine((data) => Boolean(data.youtubeUrl) !== Boolean(data.videoId), {
  message: 'Provide exactly one of: youtubeUrl OR videoId.',
  path: ['youtubeUrl'],
});

export type TranscriptGetQueryInput = z.infer<typeof transcriptGetQuerySchema>;

/** Request schema for `POST /api/transcript/update` */
export const transcriptUpdateRequestSchema = z.object({
  videoId: z.string().min(1),
  language: z.string().optional(),
  segments: z.array(transcriptSegmentSchema).min(1),
});

export type TranscriptUpdateRequestInput = z.infer<typeof transcriptUpdateRequestSchema>;
