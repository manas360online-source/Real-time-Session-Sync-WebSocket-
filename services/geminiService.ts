import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSessionSentiment = async (messages: Message[]): Promise<string> => {
  if (messages.length === 0) return "No messages to analyze.";

  const conversationText = messages
    .map(m => `${m.senderRole.toUpperCase()}: ${m.content}`)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a clinical supervisor assistant. Analyze the following brief therapy session transcript. 
      Provide a concise summary (max 3 sentences) of the patient's emotional state and one suggestion for the therapist.
      
      Transcript:
      ${conversationText}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed
      }
    });

    return response.text || "Could not generate analysis.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "AI Analysis temporarily unavailable.";
  }
};
