import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scriptService, contentAngleService } from '../src/container/index.js';
import type { TranscriptDocument } from '../src/types/transcript.js';
import type { ContentAngleContext } from '../src/content/angle.service.js';

async function main() {
  const raw = await readFile('outputs/DeyLc0nlM-M/transcripts/DeyLc0nlM-M.json', 'utf-8');
  const transcript = JSON.parse(raw) as TranscriptDocument;

  console.log('Transcript loaded. Segments count:', transcript.segments.length);

  const angleContext: ContentAngleContext = {
    candidateId: 'candidate_0',
    momentSegments: transcript.segments.slice(0, 7),
    contextSegments: transcript.segments.slice(7, 10),
    candidateTitle: 'Viral Moment',
    candidateHook: '',
    candidateReason: '',
    clipStart: transcript.segments[0]!.start,
    clipEnd: transcript.segments[6]!.end,
    sourceTitle: 'DeyLc0nlM-M',
    sourceChannel: '',
    sourceLanguage: 'id',
    genre: 'sports',
  };

  const angleResult = await contentAngleService.generateAngles(angleContext);
  console.log('Angle result generated. Angles count:', angleResult.angles.length);
  const selectedAngle = angleResult.angles[0]!;

  const scriptContext = {
    candidateId: angleResult.candidateId,
    angleId: selectedAngle.id,
    angleTitle: selectedAngle.title,
    angleHook: selectedAngle.hook,
    angleReason: selectedAngle.reason,
    angleType: selectedAngle.angleType,
    fixedHook: 'MOMEN EMAS YANG MENGUBAH SEGALANYA!',
    momentSegments: angleContext.momentSegments,
    contextSegments: angleContext.contextSegments,
    candidateTitle: angleContext.candidateTitle,
    candidateHook: angleContext.candidateHook,
    sourceTitle: angleContext.sourceTitle,
    sourceChannel: angleContext.sourceChannel,
    sourceLanguage: 'en',
    targetLanguage: 'id',
    genre: 'sports' as const,
  };

  console.log('Calling scriptService.generateScript...');
  try {
    const script = await scriptService.generateScript(scriptContext);
    console.log('SUCCESS! Script generated:', JSON.stringify(script, null, 2));
  } catch (err: any) {
    console.error('ERROR IN SCRIPT SERVICE:', err);
    if (err.stack) console.error(err.stack);
  }
}

main().catch(console.error);
