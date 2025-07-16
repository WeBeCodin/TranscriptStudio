import { GoogleGenerativeAI } from '@google/generative-ai';

// Input: { transcript: string }
export async function suggestHotspots({ transcript }: { transcript: string }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `You are an expert social media video editor. Analyze the following transcript and identify 3-5 "hotspots" or compelling segments that would make great short-form video clips. For each hotspot, provide a start time, end time, a catchy title, and a brief reason.

Transcript:
${transcript}

Please output a valid JSON array, where each object has: start_time, end_time, title, reason.`;

  const result = await model.generateContent(prompt);

  try {
    return JSON.parse(result.response.text());
  } catch {
    return result.response.text();
  }
}