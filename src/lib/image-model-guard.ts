/** Heuristic: comic/cover image scenes must not be sent to chat-text model IDs. */
export function isLikelyImageGenerationModel(model: string | null | undefined): boolean {
  const m = model?.trim().toLowerCase() ?? "";
  if (!m) return false;
  if (
    /gpt-image|chatgpt-image|dall-e|dall·e|dalle|seedream|imagen|flux|stable-diffusion|sdxl|cogview|wanx|image-preview|gemini-[\w.-]*image/.test(
      m,
    )
  ) {
    return true;
  }
  if (
    /openrouter\/free|deepseek|claude|gpt-4|gpt-5|o1-|o3-|o4-|qwen-plus|qwen-turbo|qwen-max|doubao-seed-1|doubao-1-|llama|mistral|kimi|moonshot/.test(
      m,
    )
  ) {
    return false;
  }
  return true;
}

/** Gemini generateContent image path: Seedream / gpt-image must not be sent here. */
export function isLikelyGeminiNativeImageModel(model: string | null | undefined): boolean {
  const m = model?.trim().toLowerCase() ?? "";
  if (!m) return false;
  return /gemini|imagen/.test(m);
}
