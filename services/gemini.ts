import { GoogleGenerativeAI } from "@google/generative-ai";
import { FormData, ModelChoice } from '../types';

// Helper to validate the shape of the generated JSON
const isValidScenario = (data: any): data is FormData => {
  return data && 
    typeof data.projectName === 'string' &&
    typeof data.projectDescription === 'string' &&
    ['public', 'private', 'hybrid'].includes(data.dataPrivacy) &&
    ['realtime', 'batch'].includes(data.latency) &&
    ['simple', 'moderate', 'reasoning'].includes(data.complexity) &&
    ['edge', 'cloud'].includes(data.hardware) &&
    ['offline', 'online'].includes(data.connectivity);
};

export const generateRandomScenario = async (): Promise<FormData | null> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    console.warn("API Key missing for scenario generation");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // 1. Force a 50/50 Mathematical Split
  // The scoring threshold is 25. 
  // > 25 = LLM
  // <= 25 = SLM
  const targetIsLLM = Math.random() > 0.5;

  // 2. Construct specific instructions to ensure the score aligns with the target
  // We explicitly guide the AI to pick options that carry high points (for LLM) or low points (for SLM).
  // See types.ts for scoring values.
  const directive = targetIsLLM 
    ? `TARGET: LARGE LANGUAGE MODEL (LLM). 
       You MUST generate a scenario that scores HIGH on complexity and scale.
       MANDATORY CONSTRAINTS (Pick at least 3 of these to ensure LLM fit):
       - dataPrivacy: 'public' (High Score)
       - hardware: 'cloud' (High Score)
       - complexity: 'reasoning' (High Score)
       - latency: 'batch' (High Score)
       - connectivity: 'online' (High Score)`
    : `TARGET: SMALL LANGUAGE MODEL (SLM).
       You MUST generate a scenario that requires efficiency, privacy, or works on-device.
       MANDATORY CONSTRAINTS (Pick at least 3 of these to ensure SLM fit):
       - dataPrivacy: 'private' (Low Score)
       - hardware: 'edge' (Low Score)
       - complexity: 'simple' (Low Score)
       - latency: 'realtime' (Low Score)
       - connectivity: 'offline' (Low Score)`;

  const prompt = `
    Generate a unique, realistic software project scenario.
    
    ${directive}
    
    1. **Project Content**: The 'projectName' and 'projectDescription' MUST match the constraints chosen.
       (e.g., If 'offline' and 'edge', describe a field tool or embedded system. If 'cloud' and 'public', describe a web scraper or big data analyzer).
    2. **Variety**: Within the mandatory constraints, vary the specific combination so it's not identical every time.
    
    Return a valid JSON object with these exact keys:
    {
      "projectName": "Creative Name",
      "projectDescription": "Brief description",
      "dataPrivacy": "public" | "private" | "hybrid",
      "latency": "realtime" | "batch",
      "complexity": "simple" | "moderate" | "reasoning",
      "hardware": "edge" | "cloud",
      "connectivity": "offline" | "online"
    }
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.1, // High temperature for variety
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) return null;

    const data = JSON.parse(text);
    
    if (isValidScenario(data)) {
      return data;
    }
    console.warn("Invalid scenario generated:", data);
    return null;

  } catch (error) {
    console.error("AI Scenario Generation Error:", error);
    return null;
  }
};

export const generateEvaluation = async (formData: FormData, decision: ModelChoice, score: number): Promise<string> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    return "API Key is missing. Unable to generate AI explanation.";
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
    You are a Senior Solutions Architect. 
    Analyze the following project requirements and the calculated recommendation.
    
    Project: ${formData.projectName}
    Desc: ${formData.projectDescription}
    
    Constraints:
    - Privacy: ${formData.dataPrivacy}
    - Latency: ${formData.latency}
    - Complexity: ${formData.complexity}
    - Hardware: ${formData.hardware}
    - Connectivity: ${formData.connectivity}
    
    Recommendation: ${decision}
    
    Task:
    Provide a professional, concise executive summary (approx 150 words) explaining WHY this specific architecture is the correct choice.
    Focus on business value, trade-offs, and architectural fit.
    
    STRICT RULES:
    - No technical jargon (e.g. no "tokens", "parameters", "transformers").
    - No specific model names (e.g. no "Gemini", "GPT", "Llama").
    - Do not mention you are an AI.
    - Plain text only (no markdown).
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Analysis generated, but no text returned.";
  } catch (error) {
    console.error("AI API Error:", error);
    return "Unable to generate AI explanation due to a network or API error.";
  }
};