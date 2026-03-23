import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  score: number; // 0 to 100, where 100 is highly likely to be true
  verdict: 'True' | 'Mostly True' | 'Mixed' | 'Mostly Fake' | 'Fake';
  reasoning: string;
  redFlags: string[];
  bias: string;
  confidence: number;
  sources?: { uri: string; title: string }[];
}

export async function analyzeNews(content: string): Promise<AnalysisResult> {
  const prompt = `
    Analyze the following news content for veracity, bias, and potential misinformation.
    Use Google Search to verify the claims against the latest news and factual information.
    Provide a detailed breakdown including a score (0-100, where 100 is completely factual), 
    a verdict, specific red flags found, and an analysis of political or emotional bias.

    Content to analyze:
    "${content}"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Veracity score from 0 to 100" },
          verdict: { type: Type.STRING, enum: ["True", "Mostly True", "Mixed", "Mostly Fake", "Fake"] },
          reasoning: { type: Type.STRING, description: "Detailed markdown reasoning" },
          redFlags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of specific red flags or logical fallacies"
          },
          bias: { type: Type.STRING, description: "Analysis of bias" },
          confidence: { type: Type.NUMBER, description: "AI confidence in this assessment (0-1)" }
        },
        required: ["score", "verdict", "reasoning", "redFlags", "bias", "confidence"]
      }
    }
  });

  const rawText = response.text || "";
  
  try {
    // Clean potential markdown wrapping
    const cleanJson = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const result = JSON.parse(cleanJson) as AnalysisResult;
    
    // Extract grounding sources if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      result.sources = groundingChunks
        .filter(chunk => chunk.web)
        .map(chunk => ({
          uri: chunk.web!.uri,
          title: chunk.web!.title
        }));
    }
    
    return result;
  } catch (e) {
    console.error("Raw AI Response:", rawText);
    console.error("Parse Error:", e);
    throw new Error(`Failed to parse analysis result. The AI response was: ${rawText.substring(0, 100)}...`);
  }
}
