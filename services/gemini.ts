import { GoogleGenerativeAI } from "@google/generative-ai";
import { FormData, ModelChoice } from '../types';

export const generateRandomScenario = async (): Promise<FormData | null> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    console.warn("API Key missing for scenario generation");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const targetIsSLM = Math.random() > 0.5;

  const prompt = `
    Generate a realistic enterprise software project scenario for an AI architecture assessment.
    
    Target Outcome: ${targetIsSLM ? "SMALL LANGUAGE MODEL (SLM) - Needs privacy, edge, or offline." : "LARGE LANGUAGE MODEL (LLM) - Needs complex reasoning, cloud, or zero maintenance."}
    
    Return a valid JSON object matching this TypeScript interface exactly:
    {
      "userName": "Name",
      "email": "email",
      "companyName": "Company",
      "projectName": "Project Name",
      "projectDescription": "Description > 100 chars",
      "g1_edge": boolean,
      "g2_offline": boolean,
      "g3_dataResidency": boolean,
      "g4_regulatory": boolean,
      "g5_externalApi": "not_acceptable" | "risk_mitigation" | "fully_acceptable",
      "g6_infraRefusal": boolean,
      "g7_timeToMarket": boolean,
      "s1_latency": 1-5,
      "s2_volume": 1-5,
      "s3_cost": 1-5,
      "s4_longevity": 1-5,
      "s5_narrowness": 1-5,
      "s6_domain": 1-5,
      "s7_determinism": 1-5,
      "s8_explainability": 1-5,
      "s9_readiness": 1-5,
      "s10_maintenance": 1-5,
      "s11_investment": 1-5,
      "s12_breadth": 1-5,
      "s13_experimentation": 1-5,
      "s14_lowVolume": 1-5
    }

    Rules:
    1. If Target is SLM: Set g1, g2, or g3 to true often. Set s1, s2, s5 high (4 or 5).
    2. If Target is LLM: Set g6 or g7 to true often. Set s12, s13 high (4 or 5).
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) return null;
    return JSON.parse(text) as FormData;
  } catch (error) {
    console.error("AI Scenario Gen Error:", error);
    return null;
  }
};

export const generateEvaluation = async (formData: FormData, decision: ModelChoice, _score: number, hardBlocker?: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) return "API Key is missing. Unable to generate AI explanation.";

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
    Role: Senior Solutions Architect.
    Task: Write an executive summary (approx 150 words) justifying the selected AI architecture.
    
    Context:
    - Project: ${formData.projectName}
    - Description: ${formData.projectDescription}
    - Decision: ${decision}
    - Hard Blocker (if any): ${hardBlocker || 'None'}
    
    Key Constraints:
    - Edge/Offline Required: ${formData.g1_edge || formData.g2_offline}
    - Data Residency/Regs: ${formData.g3_dataResidency || formData.g4_regulatory}
    - Infra Refusal: ${formData.g6_infraRefusal}
    - Time to Market Critical: ${formData.g7_timeToMarket}
    
    Instructions:
    1. If a Hard Blocker exists, start by citing it as the primary reason.
    2. Explain the trade-offs (Latency vs. Intelligence, Control vs. Convenience).
    3. Be professional and direct. No markdown.
  `;

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
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