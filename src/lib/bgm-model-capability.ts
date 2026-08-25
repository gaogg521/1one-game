/**
 * Intentionally conservative model-name gate. A route may contain ordinary
 * text fallbacks; those must never receive an audio-output request.
 */
export function isAudioOutputModelId(model: string): boolean {
  return /(^|[/:_-])(gpt-?audio|audio[-_/]?mini|musicgen|stable[-_/]?audio|suno|udio)(?:$|[/:_-])/i.test(model.trim());
}
