import { GoogleGenerativeAI } from '@google/generative-ai';

// Input: { gcsUri: string }
export async function generateTranscript({ gcsUri }: { gcsUri: string }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // Gemini can't transcribe audio/video directly; use Google Speech-to-Text for that.
  const prompt = `You are an expert transcriptionist. Your task is to generate a precise, time-coded transcript from the provided media file: ${gcsUri}.

(If you need to process an actual audio or video file, use Google Speech-to-Text API first.)`;

  const result = await model.generateContent(prompt);

  return result.response.text();
}