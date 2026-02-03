export enum ViewState {
  ASSESSMENT = 'ASSESSMENT',
  RESULT = 'RESULT',
  RULES = 'RULES',
  LOGIN = 'LOGIN',
  ADMIN = 'ADMIN'
}

export enum ModelChoice {
  SLM = 'Small Language Model (SLM)',
  LLM = 'Large Language Model (LLM)'
}

export interface FormData {
  projectName: string;
  projectDescription: string;
  dataPrivacy: 'public' | 'private' | 'hybrid';
  latency: 'realtime' | 'batch';
  complexity: 'simple' | 'moderate' | 'reasoning';
  hardware: 'edge' | 'cloud';
  connectivity: 'offline' | 'online';
}

export interface Submission {
  id: string;
  user: string; // simulating a user identifier
  timestamp: Date;
  data: FormData;
  score: number;
  decision: ModelChoice;
  aiExplanation: string;
}

export const QUESTIONS = [
  {
    id: 'dataPrivacy',
    label: 'Data Privacy Requirement',
    options: [
      { value: 'public', label: 'Public Data (Low Sensitivity)', score: 10 },
      { value: 'hybrid', label: 'Hybrid / Internal', score: 5 },
      { value: 'private', label: 'Strictly Private / PII (On-Device Preferred)', score: 0 }
    ]
  },
  {
    id: 'complexity',
    label: 'Task Reasoning Complexity',
    options: [
      { value: 'reasoning', label: 'Complex Multi-step Reasoning / Creative', score: 10 },
      { value: 'moderate', label: 'Summarization / Extraction', score: 5 },
      { value: 'simple', label: 'Classification / Simple Q&A', score: 0 }
    ]
  },
  {
    id: 'latency',
    label: 'Latency Sensitivity',
    options: [
      { value: 'batch', label: 'Not Critical (Batch Processing)', score: 10 },
      { value: 'realtime', label: 'Real-time / Instant Interaction', score: 0 }
    ]
  },
  {
    id: 'hardware',
    label: 'Deployment Target',
    options: [
      { value: 'cloud', label: 'Cloud Infrastructure (GPU Clusters)', score: 10 },
      { value: 'edge', label: 'Edge / Consumer Device (Mobile/Laptop)', score: 0 }
    ]
  },
  {
    id: 'connectivity',
    label: 'Internet Connectivity',
    options: [
      { value: 'online', label: 'Always Online', score: 10 },
      { value: 'offline', label: 'Intermittent or Fully Offline', score: 0 }
    ]
  }
];

export const SCORING_THRESHOLD = 25; // > 25 = LLM, <= 25 = SLM