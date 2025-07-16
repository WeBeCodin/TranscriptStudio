import { GoogleGenerativeAI } from '@google/generative-ai';

// Input: { imageUrl: string }
export async function generateVideoBackground({ imageUrl }: { imageUrl: string }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `Analyze this video frame and generate a clean, high-resolution background image. The background should be contextually appropriate but without any people, text, or distracting foreground elements. The goal is to create a simple, aesthetically pleasing background that could be used behind text or other graphics.`;

  // Gemini supports image input
  const result = await model.generateContent([prompt, { image: { url: imageUrl } }]);

  return result.response.text();
}