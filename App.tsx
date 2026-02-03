import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ViewState, FormData, Submission, ModelChoice, GATEKEEPER_QUESTIONS, SCORED_QUESTIONS, SCORING_THRESHOLD, MAX_POSSIBLE_SCORE } from './types';
import { generateEvaluation, generateRandomScenario } from './services/gemini';
import { fetchSubmissions, saveSubmission } from './services/database';
import { AlertCircle, ArrowRight, Lock, ShieldCheck, User, Activity, BrainCircuit, Sparkles } from 'lucide-react';

// --- MOCK DATA (Fallback) ---
const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: '1',
    user: 'Sarah Jenkins',
    timestamp: new Date('2025-02-01T10:00:00'),
    data: { 
      userName: 'Sarah Jenkins', email: 'sarah@example.com', companyName: 'MedTech Inc', projectName: 'Field Medic', projectDescription: 'Offline medic helper',
      g1_edge: true, g2_offline: true, g3_dataResidency: true, g4_regulatory: false, g5_externalApi: 'not_acceptable', g6_infraRefusal: false, g7_timeToMarket: false,
      s1_latency: 5, s2_volume: 4, s3_cost: 5, s4_longevity: 5, s5_narrowness: 5, s6_domain: 5, s7_determinism: 5, s8_explainability: 4, s9_readiness: 4, s10_maintenance: 4, s11_investment: 4, s12_breadth: 1, s13_experimentation: 1, s14_lowVolume: 1
    },
    score: 240,
    maxScore: MAX_POSSIBLE_SCORE,
    decision: ModelChoice.SLM,
    aiExplanation: 'The requirement for offline capability and edge deployment strictly mandates a Small Language Model. The high scoring on volume and low latency further solidifies this choice.',
    hardBlocker: 'Offline or limited connectivity requirement'
  },
  {
    id: '2',
    user: 'David Chen',
    timestamp: new Date('2025-02-02T14:30:00'),
    data: { 
        userName: 'David Chen', email: 'd.chen@lawfirm.com', companyName: 'Global Law', projectName: 'Case Summarizer', projectDescription: 'Summarizing court cases from public web data',
        g1_edge: false, g2_offline: false, g3_dataResidency: false, g4_regulatory: false, g5_externalApi: 'fully_acceptable', g6_infraRefusal: true, g7_timeToMarket: true,
        s1_latency: 2, s2_volume: 2, s3_cost: 2, s4_longevity: 2, s5_narrowness: 2, s6_domain: 2, s7_determinism: 3, s8_explainability: 3, s9_readiness: 1, s10_maintenance: 1, s11_investment: 1, s12_breadth: 5, s13_experimentation: 5, s14_lowVolume: 4
      },
    score: 45,
    maxScore: MAX_POSSIBLE_SCORE,
    decision: ModelChoice.LLM,
    aiExplanation: 'The organization refusal to manage infrastructure and the need for rapid time-to-market necessitates a Managed LLM. The broad intelligence requirement also favors large models.',
    hardBlocker: 'Organization refuses infrastructure ownership'
  }
];

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.ASSESSMENT);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbData = await fetchSubmissions();
        if (dbData && dbData.length > 0) {
          setSubmissions(dbData);
        } else {
          setSubmissions(MOCK_SUBMISSIONS);
        }
      } catch (e) {
        console.error("Failed to load data", e);
        setSubmissions(MOCK_SUBMISSIONS);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // --- SCROLL TO TOP ON VIEW CHANGE ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- ACTIONS ---
  const handleAssessmentSubmit = async (data: FormData) => {
    let decision = ModelChoice.LLM;
    let hardBlocker = undefined;
    
    // --- 1. GATEKEEPER LOGIC ---
    // Priority: G6/G7 (Force LLM) > G1-G4 (Force SLM)
    
    // Check LLM Forcers first (Strongest Blockers against SLM)
    if (data.g6_infraRefusal) {
        decision = ModelChoice.LLM;
        hardBlocker = "Organization refuses infrastructure ownership (SLM Infeasible)";
    } else if (data.g7_timeToMarket) {
        decision = ModelChoice.LLM;
        hardBlocker = "Time-to-market constraint favors managed LLMs";
    } 
    // If no LLM force, check SLM Forcers
    else if (data.g1_edge) {
        decision = ModelChoice.SLM;
        hardBlocker = "On-device or edge deployment requirement";
    } else if (data.g2_offline) {
        decision = ModelChoice.SLM;
        hardBlocker = "Offline or limited connectivity requirement";
    } else if (data.g3_dataResidency) {
        decision = ModelChoice.SLM;
        hardBlocker = "Internal-only data and inference requirement";
    } else if (data.g4_regulatory) {
        decision = ModelChoice.SLM;
        hardBlocker = "Regulatory mandate for model control";
    }

    // --- 2. SCORING LOGIC ---
    // Calculate score regardless of gatekeepers for reporting
    let weightedScore = 0;
    
    SCORED_QUESTIONS.forEach(q => {
        const userValue = data[q.id as keyof FormData] as number;
        // If reverse: (6 - userValue) * weight. If normal: userValue * weight.
        const effectiveValue = q.reverse ? (6 - userValue) : userValue;
        weightedScore += effectiveValue * q.weight;
    });

    // If no hard blocker, use score
    if (!hardBlocker) {
        // G5 Check: "Not Acceptable" strongly favors SLM. 
        // We can treat it as a tie-breaker or simple weight. 
        // Given the prompt, let's let the score drive, but G5 is implicitly captured in risk/readiness questions often.
        // If G5 is not_acceptable, we might nudge, but let's stick to the math:
        
        if (weightedScore >= SCORING_THRESHOLD) {
            decision = ModelChoice.SLM;
        } else {
            decision = ModelChoice.LLM;
        }
    }

    // 3. Create Submission Object
    const tempId = Math.random().toString(36).substr(2, 9);
    const newSubmission: Submission = {
      id: tempId,
      user: data.userName || 'Guest User',
      timestamp: new Date(),
      data,
      score: weightedScore,
      maxScore: MAX_POSSIBLE_SCORE,
      decision,
      hardBlocker,
      aiExplanation: "Analyzing detailed constraints..."
    };

    setCurrentSubmission(newSubmission);
    setView(ViewState.RESULT);

    // 4. Async AI Call
    const explanation = await generateEvaluation(data, decision, weightedScore, hardBlocker);
    
    const finalSubmission = { ...newSubmission, aiExplanation: explanation };
    setCurrentSubmission(finalSubmission);
    
    // 5. Update State & DB
    setSubmissions(prev => [finalSubmission, ...prev]);
    await saveSubmission(finalSubmission);
  };

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAdmin(true);
      setView(ViewState.ADMIN);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar currentView={view} changeView={setView} isAdmin={isAdmin} />
      
      <main className="flex-grow flex flex-col">
        {view === ViewState.ASSESSMENT && <AssessmentPage onSubmit={handleAssessmentSubmit} />}
        {view === ViewState.RESULT && currentSubmission && <ResultPage submission={currentSubmission} onReset={() => setView(ViewState.ASSESSMENT)} onViewRules={() => setView(ViewState.RULES)} />}
        {view === ViewState.RULES && <RulesPage />}
        {view === ViewState.LOGIN && <LoginPage onLogin={handleLogin} />}
        {view === ViewState.ADMIN && <AdminPage submissions={submissions} />}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        <p>&copy; 2026 InfoVision. SLM vs LLM Framework.</p>
      </footer>
    </div>
  );
}

// ==========================================
// PAGE 1: ASSESSMENT FORM (UPDATED)
// ==========================================
const AssessmentPage = ({ onSubmit }: { onSubmit: (data: FormData) => void }) => {
  const [formData, setFormData] = useState<Partial<FormData>>({
    // Defaults for likert to middle to avoid nulls
    s1_latency: 3, s2_volume: 3, s3_cost: 3, s4_longevity: 3, s5_narrowness: 3, 
    s6_domain: 3, s7_determinism: 3, s8_explainability: 3, s9_readiness: 3, 
    s10_maintenance: 3, s11_investment: 3, s12_breadth: 3, s13_experimentation: 3, s14_lowVolume: 3,
    g1_edge: false, g2_offline: false, g3_dataResidency: false, g4_regulatory: false, g6_infraRefusal: false, g7_timeToMarket: false,
    g5_externalApi: 'risk_mitigation' as any
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateScenario = async () => {
    setIsGenerating(true);
    const scenario = await generateRandomScenario();
    if (scenario) {
      setFormData(scenario);
    } else {
      alert("Could not generate scenario. Please check your network.");
    }
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.projectDescription || !formData.userName) {
        alert("Please fill in the required User Info fields.");
        return;
    }
    setIsSubmitting(true);
    onSubmit(formData as FormData);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">SLM vs LLM Decision Assessment</h1>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Evaluate deployment constraints, scale, and operational readiness to determine the optimal AI architecture.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* ACTION BAR */}
        <div className="flex justify-end mb-2">
             <button 
              type="button" 
              onClick={handleGenerateScenario}
              disabled={isGenerating}
              className="text-indigo-600 hover:text-white text-sm font-semibold hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 flex items-center bg-indigo-50 px-5 py-2.5 rounded-full transition-all duration-300 shadow-sm"
             >
               {isGenerating ? 'Generating...' : <><Sparkles className="w-4 h-4 mr-2" /> Auto-Fill Scenario</>}
             </button>
        </div>

        {/* SECTION 1: USER INFO */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
            <User className="w-5 h-5 text-indigo-600 mr-2.5" />
            <h2 className="text-xl font-bold text-slate-800">User Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <input required type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.userName || ''} onChange={(e) => handleChange('userName', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
                <input required type="email" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company Name</label>
                <input type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.companyName || ''} onChange={(e) => handleChange('companyName', e.target.value)} />
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Name *</label>
                <input required type="text" className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  value={formData.projectName || ''} onChange={(e) => handleChange('projectName', e.target.value)} />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Description * (Min 100 chars)</label>
                <textarea required minLength={100} className="w-full px-3 py-2.5 text-sm border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none transition" 
                  placeholder="Describe your use case..."
                  value={formData.projectDescription || ''} onChange={(e) => handleChange('projectDescription', e.target.value)} />
            </div>
          </div>
        </div>

        {/* SECTION 2: GATEKEEPERS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center">
                <ShieldCheck className="w-5 h-5 text-red-600 mr-2.5" />
                <h2 className="text-xl font-bold text-slate-800">Deployment & Compliance Gatekeepers</h2>
            </div>
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">High Priority</span>
          </div>
          <div className="p-6 space-y-5">
            {GATEKEEPER_QUESTIONS.map((q) => (
                <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="pr-4 mb-3 md:mb-0 max-w-3xl">
                        <p className="text-base font-semibold text-slate-800 leading-snug">{q.label}</p>
                        {q.subLabel && <p className="text-sm text-slate-500 mt-1">{q.subLabel}</p>}
                    </div>
                    <div className="flex space-x-2 flex-shrink-0">
                         <button type="button" 
                            onClick={() => handleChange(q.id as keyof FormData, true)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition shadow-sm border ${formData[q.id as keyof FormData] === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                            Yes
                         </button>
                         <button type="button" 
                            onClick={() => handleChange(q.id as keyof FormData, false)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition shadow-sm border ${formData[q.id as keyof FormData] === false ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                            No
                         </button>
                    </div>
                </div>
            ))}
            {/* G5 Special Case */}
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3">
                <div className="pr-4 mb-3 md:mb-0">
                    <p className="text-base font-semibold text-slate-800">How acceptable is dependency on third-party AI APIs?</p>
                </div>
                <div className="relative">
                  <select 
                      value={formData.g5_externalApi}
                      onChange={(e) => handleChange('g5_externalApi', e.target.value)}
                      className="bg-white border border-slate-300 text-slate-800 text-sm font-medium rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-auto p-2.5 pr-8 shadow-sm outline-none cursor-pointer"
                  >
                      <option value="not_acceptable">Not acceptable under any circumstances</option>
                      <option value="risk_mitigation">Acceptable with risk mitigation</option>
                      <option value="fully_acceptable">Fully acceptable</option>
                  </select>
                </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SCORED QUESTIONS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
            <Activity className="w-5 h-5 text-indigo-600 mr-2.5" />
            <h2 className="text-xl font-bold text-slate-800">Operational & Strategic Assessment</h2>
          </div>
          <div className="p-6 space-y-8">
            <div className="bg-indigo-50 p-3 rounded-lg flex items-start">
               <div className="bg-indigo-200 p-0.5 rounded-full mr-2.5 mt-0.5"><Activity className="w-3.5 h-3.5 text-indigo-700" /></div>
               <p className="text-sm text-indigo-900 font-medium">Rate your agreement with the following statements on a scale from 1 (Strongly Disagree) to 5 (Strongly Agree).</p>
            </div>
            
            {SCORED_QUESTIONS.map((q) => (
                <div key={q.id} className="border-b border-slate-100 pb-6 last:pb-0 last:border-0">
                    <div className="mb-3">
                        <label className="text-base font-semibold text-slate-800 leading-snug block mb-2">{q.text}</label>
                    </div>
                    
                    {/* CUSTOM RATING BUTTONS 1-5 */}
                    <div className="flex flex-col space-y-2">
                      <div className="flex gap-2 w-full">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleChange(q.id as keyof FormData, val)}
                            className={`flex-1 py-2.5 rounded-lg text-sm md:text-base font-bold transition-all border shadow-sm ${
                              (formData[q.id as keyof FormData] as number) === val
                                ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200 transform scale-[1.02]'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between px-1 mt-0.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Strongly Disagree</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Neutral</span>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Strongly Agree</span>
                      </div>
                    </div>
                </div>
            ))}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex justify-center items-center transform hover:-translate-y-0.5"
        >
          {isSubmitting ? 'Analyzing Framework...' : 'Generate Recommendation'}
          {!isSubmitting && <ArrowRight className="ml-2.5 w-5 h-5" />}
        </button>

      </form>
    </div>
  );
};

// ==========================================
// PAGE 2: RESULT (UPDATED)
// ==========================================
const ResultPage = ({ submission, onReset, onViewRules }: { submission: Submission, onReset: () => void, onViewRules: () => void }) => {
  const isLLM = submission.decision === ModelChoice.LLM;
  const scorePercent = Math.round((submission.score / submission.maxScore) * 100);

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-grow flex flex-col">
      
      {/* Header Decision */}
      <div className={`text-center py-12 rounded-t-2xl ${isLLM ? 'bg-gradient-to-br from-indigo-900 to-purple-800' : 'bg-gradient-to-br from-emerald-800 to-teal-700'} text-white shadow-2xl relative overflow-hidden`}>
        <div className="relative z-10 px-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] opacity-80 mb-3">Architectural Recommendation</h2>
            <h1 className="text-6xl font-black tracking-tighter mb-4 drop-shadow-lg">{isLLM ? 'LLM' : 'SLM'}</h1>
            <p className="text-2xl font-light opacity-95">{submission.decision}</p>
            {submission.hardBlocker && (
                <div className="mt-6 inline-flex items-center bg-black/30 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20">
                    <Lock className="w-4 h-4 mr-2.5 text-red-300" />
                    <p className="text-base font-medium text-red-100">
                        Forced by: {submission.hardBlocker}
                    </p>
                </div>
            )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-b-2xl shadow-xl border-x border-b border-slate-200 p-8 md:p-10 mb-8">
        
        {/* Score Visual */}
        <div className="mb-10">
            <div className="flex justify-between items-end mb-3">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fit Score</span>
                <span className="text-base font-bold text-slate-700">{submission.score} / {submission.maxScore} Points</span>
            </div>
            <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                {/* 0-50% LLM Zone, 50-100% SLM Zone */}
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${isLLM ? 'bg-purple-600' : 'bg-emerald-500'}`} 
                    style={{ width: `${scorePercent}%` }}
                ></div>
            </div>
            <div className="flex justify-between mt-2.5 text-xs text-slate-400 font-medium">
                <span>Strongly LLM</span>
                <span className="text-slate-300">| Threshold (130)</span>
                <span>Strongly SLM</span>
            </div>
        </div>

        <div className="flex items-start mb-6">
          <div className="bg-indigo-50 p-3 rounded-xl mr-4">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Executive Summary</h3>
            <p className="text-slate-500 text-sm">Generated based on {Object.keys(submission.data).length} architectural constraints</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed mb-10">
           <p className="whitespace-pre-line">{submission.aiExplanation}</p>
        </div>

        <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Infrastructure</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g6_infraRefusal ? <span className="text-purple-600">Managed (LLM)</span> : <span className="text-emerald-600">Self-Hosted (SLM)</span>}
            </span>
          </div>
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Connectivity</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g2_offline ? "Offline Required" : "Online Allowed"}
            </span>
          </div>
           <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1.5">Time to Market</span>
            <span className="text-slate-900 text-base font-bold flex items-center">
                {submission.data.g7_timeToMarket ? "Immediate (Weeks)" : "Standard"}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        <button onClick={onReset} className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-bold text-base shadow-sm hover:shadow-md">
          Start New Assessment
        </button>
        <button onClick={onViewRules} className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-md hover:shadow-lg transition font-bold text-base">
          Methodology & Rules
        </button>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 3: RULES
// ==========================================
const RulesPage = () => {
  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8 tracking-tight">Assessment Methodology</h1>
      
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-5 flex items-center">
                <ShieldCheck className="w-7 h-7 text-red-600 mr-3" />
                Gatekeepers (Hard Constraints)
            </h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed max-w-4xl">
                These questions represent "hard blockers". Answering <span className="font-bold text-slate-900">Yes</span> to specific gatekeepers immediately forces a decision regardless of the score.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {GATEKEEPER_QUESTIONS.map(q => (
                    <div key={q.id} className="flex items-start bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className={`mt-1.5 min-w-[6px] h-6 rounded-full mr-3 ${q.forceDecision === ModelChoice.SLM ? 'bg-emerald-500' : 'bg-purple-600'}`}></div>
                        <div>
                            <p className="text-base font-bold text-slate-800">{q.label}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-1.5">
                                Forces: <span className={q.forceDecision === ModelChoice.SLM ? 'text-emerald-600' : 'text-purple-600'}>{q.forceDecision === ModelChoice.SLM ? 'SLM' : 'LLM'}</span>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-5 flex items-center">
                <Activity className="w-7 h-7 text-indigo-600 mr-3" />
                Scored Dimensions
            </h2>
             <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                If no hard blockers exist, the system calculates a weighted score based on these dimensions.
                <br/>
                <span className="inline-block bg-slate-100 px-2.5 py-0.5 rounded-md mt-2 text-slate-800 font-bold text-base">Threshold: {SCORING_THRESHOLD} / {MAX_POSSIBLE_SCORE}</span> <span className="text-slate-500 text-sm ml-2">(Higher Score = Favors SLM)</span>
            </p>
             <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {SCORED_QUESTIONS.map(q => (
                    <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-2.5">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">Weight: {q.weight}</span>
                            {q.reverse && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded uppercase tracking-wider">Reverse</span>}
                        </div>
                        <p className="text-base text-slate-800 font-medium leading-snug mb-2.5">{q.text}</p>
                        <p className="text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                            {q.reverse ? 'High Agreement → Favors LLM' : 'High Agreement → Favors SLM'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 4: LOGIN
// ==========================================
const LoginPage = ({ onLogin }: { onLogin: (success: boolean) => void }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple client-side check for demo purposes
        if (password === '$Infovision2026$') {
            onLogin(true);
        } else {
            setError(true);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                <div className="text-center mb-6">
                    <div className="bg-indigo-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-7 h-7 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
                    <p className="text-slate-500 text-sm mt-1">Restricted access for architecture review board.</p>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <input 
                            type="password" 
                            className="w-full px-3 py-2.5 text-base border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(false); }}
                            placeholder="Enter admin password"
                        />
                    </div>
                    {error && <p className="text-red-600 text-sm mb-5 flex items-center"><AlertCircle className="w-4 h-4 mr-2"/> Invalid password</p>}
                    
                    <button type="submit" className="w-full bg-slate-900 text-white font-bold text-base py-3 rounded-lg hover:bg-slate-800 transition shadow-lg">
                        Access Dashboard
                    </button>
                </form>
            </div>
        </div>
    );
};

// ==========================================
// PAGE 5: ADMIN
// ==========================================
const AdminPage = ({ submissions }: { submissions: Submission[] }) => {
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

    const handleRowClick = (submission: Submission) => {
        setSelectedSubmission(submission);
    };

    const handleCloseDetail = () => {
        setSelectedSubmission(null);
    };

    return (
        <div className="max-w-6xl mx-auto w-full px-6 py-10">
             <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Assessment Dashboard</h1>
                    <p className="text-slate-500 text-base mt-0.5">Reviewing {submissions.length} architecture decisions</p>
                </div>
                <div className="flex space-x-3">
                    <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold shadow-sm">
                        LLM: {submissions.filter(s => s.decision === ModelChoice.LLM).length}
                    </div>
                    <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold shadow-sm">
                        SLM: {submissions.filter(s => s.decision === ModelChoice.SLM).length}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Decision</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {submissions.map((sub) => (
                                <tr 
                                    key={sub.id} 
                                    onClick={() => handleRowClick(sub)}
                                    className="hover:bg-slate-50 transition cursor-pointer"
                                >
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-bold text-slate-900">{sub.data.projectName}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{sub.data.projectDescription}</div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">{sub.user}</div>
                                        <div className="text-xs text-slate-500">{sub.data.email}</div>
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm ${sub.decision === ModelChoice.SLM ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}`}>
                                            {sub.decision === ModelChoice.SLM ? 'SLM' : 'LLM'}
                                        </span>
                                        {sub.hardBlocker && <div className="mt-1.5 text-xs text-red-500 font-semibold flex items-center"><Lock className="w-3 h-3 mr-1"/> Forced</div>}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-600">
                                        {sub.score} / {sub.maxScore}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-500">
                                        {sub.timestamp.toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {submissions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-base">
                                        No assessments recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedSubmission && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleCloseDetail}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className={`p-8 ${selectedSubmission.decision === ModelChoice.LLM ? 'bg-gradient-to-br from-indigo-900 to-purple-800' : 'bg-gradient-to-br from-emerald-800 to-teal-700'} text-white relative`}>
                            <button 
                                onClick={handleCloseDetail}
                                className="absolute top-6 right-6 text-white/80 hover:text-white transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <h2 className="text-3xl font-bold mb-2">{selectedSubmission.data.projectName}</h2>
                            <p className="text-white/90 mb-4">{selectedSubmission.data.projectDescription}</p>
                            <div className="flex items-center gap-4">
                                <span className="text-5xl font-black">{selectedSubmission.decision === ModelChoice.LLM ? 'LLM' : 'SLM'}</span>
                                <div>
                                    <p className="text-sm opacity-80">Score: {selectedSubmission.score} / {selectedSubmission.maxScore}</p>
                                    <p className="text-sm opacity-80">Date: {selectedSubmission.timestamp.toLocaleDateString()}</p>
                                </div>
                            </div>
                            {selectedSubmission.hardBlocker && (
                                <div className="mt-4 inline-flex items-center bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                                    <Lock className="w-4 h-4 mr-2 text-red-300" />
                                    <p className="text-sm font-medium">Hard Blocker: {selectedSubmission.hardBlocker}</p>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-6">
                            {/* User Info */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                    <User className="w-5 h-5 mr-2 text-indigo-600" />
                                    User Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase">Name</p>
                                        <p className="text-sm font-medium text-slate-900">{selectedSubmission.data.userName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase">Email</p>
                                        <p className="text-sm font-medium text-slate-900">{selectedSubmission.data.email}</p>
                                    </div>
                                    {selectedSubmission.data.companyName && (
                                        <div className="col-span-2">
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Company</p>
                                            <p className="text-sm font-medium text-slate-900">{selectedSubmission.data.companyName}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AI Explanation */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                    <BrainCircuit className="w-5 h-5 mr-2 text-indigo-600" />
                                    AI Executive Summary
                                </h3>
                                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100">
                                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{selectedSubmission.aiExplanation}</p>
                                </div>
                            </div>

                            {/* Gatekeeper Responses */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                    <ShieldCheck className="w-5 h-5 mr-2 text-red-600" />
                                    Gatekeeper Responses
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {GATEKEEPER_QUESTIONS.map((q) => {
                                        const value = selectedSubmission.data[q.id as keyof FormData];
                                        return (
                                            <div key={q.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{q.label}</p>
                                                <p className={`text-sm font-bold ${value ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {value ? 'Yes' : 'No'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">External API Dependency</p>
                                        <p className="text-sm font-bold text-slate-900 capitalize">
                                            {selectedSubmission.data.g5_externalApi?.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Scored Responses */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                    <Activity className="w-5 h-5 mr-2 text-indigo-600" />
                                    Scored Dimensions
                                </h3>
                                <div className="space-y-3">
                                    {SCORED_QUESTIONS.map((q) => {
                                        const value = selectedSubmission.data[q.id as keyof FormData] as number;
                                        return (
                                            <div key={q.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-medium text-slate-800 flex-1">{q.text}</p>
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded ml-2">
                                                        Weight: {q.weight}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex gap-1 flex-1">
                                                        {[1, 2, 3, 4, 5].map((v) => (
                                                            <div
                                                                key={v}
                                                                className={`h-2 flex-1 rounded ${
                                                                    v <= value ? 'bg-indigo-600' : 'bg-slate-200'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900 w-8 text-right">{value}/5</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Close Button */}
                            <div className="flex justify-end pt-4 border-t border-slate-200">
                                <button
                                    onClick={handleCloseDetail}
                                    className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-bold"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};