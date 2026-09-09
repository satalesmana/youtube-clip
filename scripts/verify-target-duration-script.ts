import assert from 'node:assert/strict';
import {
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  type ScriptContext,
} from '../src/content/content.prompt.js';
import { scriptDraftRequestSchema } from '../src/schemas/script.schema.js';
import { transformRequestSchema } from '../src/schemas/transform.schema.js';

console.log('Testing schema targetDuration validation...');
{
  const validDraft = scriptDraftRequestSchema.safeParse({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    targetDuration: 90,
  });
  assert(validDraft.success, 'scriptDraftRequestSchema accepts targetDuration');
  assert.equal(validDraft.data.targetDuration, 90);

  const validTransform = transformRequestSchema.safeParse({
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    targetDuration: 105,
  });
  assert(validTransform.success, 'transformRequestSchema accepts targetDuration');
  assert.equal(validTransform.data.targetDuration, 105);
}

console.log('Testing buildScriptSystemPrompt for standard (60s) vs extended (90s) duration...');
{
  const system60 = buildScriptSystemPrompt(60, 'commentary');
  assert(system60.includes('Target narration length: approximately 60 seconds at 150 words per minute (~150 words total)'));
  assert(system60.includes('"analysis" sections should be concise but substantive'));

  const system90 = buildScriptSystemPrompt(90, 'commentary');
  assert(system90.includes('Target narration length: approximately 90 seconds at 150 words per minute (~225 words total)'));
  assert(system90.includes('The selected video footage is 90 seconds long; your voiceover narration MUST comfortably fill this entire duration (~225 words)'));
  assert(system90.includes('expanded for 90s / ~225 words'));
  assert(system90.includes('"analysis" — deeper breakdown, tactical/editorial implications, and causes (3-6 sentences)'));
  assert(system90.includes('Fully elaborate on context, background facts, and analytical insights so the narration comfortably spans the full runtime'));
}

console.log('Testing buildScriptSystemPrompt for sports genre with >60s duration...');
{
  const sports90 = buildScriptSystemPrompt(90, 'sports');
  assert(sports90.includes('Keep the narration high-energy, visceral, and fast-paced, but sustain the storytelling across the full duration'));
  assert(!sports90.includes('omitted entirely when beats do not justify them')); // Does not discard analysis for long clips
}

console.log('Testing buildScriptUserPrompt with multi-clips totaling >60s...');
{
  const context: ScriptContext = {
    candidateId: 'cand_1',
    angleId: 'angle_1',
    angleTitle: 'Headline',
    angleHook: 'Opening Hook',
    angleReason: 'Reason',
    angleType: 'commentary',
    targetDurationSeconds: 95,
    momentSegments: [
      { start: 0, end: 10, text: 'First segment' },
      { start: 80, end: 95, text: 'Last segment' },
    ],
    candidateTitle: 'Viral News',
    candidateHook: 'Hook Text',
    sourceTitle: 'Breaking News',
    sourceChannel: 'Channel',
    genre: 'commentary',
    selectedClips: [
      { start: 10, end: 40, title: 'Clip 1' },
      { start: 100, end: 135, title: 'Clip 2' },
      { start: 200, end: 230, title: 'Clip 3' },
    ],
  };

  const userPrompt = buildScriptUserPrompt(context);
  assert(userPrompt.includes('User Selected Multi-Clip Sequence (3 clips)'));
  assert(userPrompt.includes('Total sequence duration: approximately 95 seconds (~238 words total)'));
  assert(userPrompt.includes('pacing the narration to comfortably fill the full ~95s duration'));
}

console.log('Testing buildScriptUserPrompt with single hook recommendation >60s...');
{
  const context: ScriptContext = {
    candidateId: 'cand_1',
    angleId: 'angle_1',
    angleTitle: 'Headline',
    angleHook: 'Opening Hook',
    angleReason: 'Reason',
    angleType: 'commentary',
    targetDurationSeconds: 80,
    momentSegments: [
      { start: 10, end: 90, text: 'Moment' },
    ],
    candidateTitle: 'Viral News',
    candidateHook: 'Hook Text',
    sourceTitle: 'Breaking News',
    sourceChannel: 'Channel',
  };

  const userPrompt = buildScriptUserPrompt(context);
  assert(userPrompt.includes('Target footage duration: approximately 80 seconds (~200 words total)'));
  assert(userPrompt.includes('Ensure narration length and pacing matches this duration'));
}

console.log('All verification tests passed successfully!');
