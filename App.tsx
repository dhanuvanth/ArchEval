import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ViewState, FormData, Submission, ModelChoice, SCORING_THRESHOLD, QUESTIONS } from './types';
import { generateEvaluation, generateRandomScenario } from './services/gemini';
import { fetchSubmissions, saveSubmission } from './services/database';
import { CheckCircle2, AlertCircle, ArrowRight, Lock, Server, Cpu, ShieldCheck, FileText, Activity, Sparkles, BrainCircuit } from 'lucide-react';

// --- Page Components Defined Below within App.tsx to maintain single file requirement structure per instructions where possible, 
// though split for clarity is handled by conditional rendering ---

// --- MOCK DATA (Fallback) ---
const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: '1',
    user: 'Sarah Jenkins',
    timestamp: new Date('2025-02-01T10:00:00'),
    data: { projectName: 'Offline Field Medic', projectDescription: 'A helper for medics in remote areas', dataPrivacy: 'private', latency: 'realtime', complexity: 'moderate', hardware: 'edge', connectivity: 'offline' },
    score: 5,
    decision: ModelChoice.SLM,
    aiExplanation: 'Given the critical need for offline connectivity and strict data privacy on edge devices, an SLM is the mandatory architectural choice. The latency requirements further support a local deployment.'
  },
  {
    id: '2',
    user: 'David Chen',
    timestamp: new Date('2025-02-02T14:30:00'),
    data: { projectName: 'Legal Doc Analyzer', projectDescription: 'Scanning huge repositories of public law', dataPrivacy: 'public', latency: 'batch', complexity: 'reasoning', hardware: 'cloud', connectivity: 'online' },
    score: 40,
    decision: ModelChoice.LLM,
    aiExplanation: 'The high complexity of legal reasoning combined with the massive public dataset makes a Cloud-based LLM the superior choice. Privacy is not a blocker, and batch processing allows for larger model inference.'
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
    // 1. Calculate Score
    let score = 0;
    QUESTIONS.forEach(q => {
      const selectedOption = q.options.find(opt => opt.value === data[q.id as keyof FormData]);
      if (selectedOption) score += selectedOption.score;
    });

    // 2. Determine Decision
    const decision = score > SCORING_THRESHOLD ? ModelChoice.LLM : ModelChoice.SLM;

    // 3. Create Submission Object (Temp)
    const tempId = Math.random().toString(36).substr(2, 9);
    const newSubmission: Submission = {
      id: tempId,
      user: `Guest User ${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date(),
      data,
      score,
      decision,
      aiExplanation: "Analyzing constraints..."
    };

    setCurrentSubmission(newSubmission);
    setView(ViewState.RESULT);

    // 4. Async AI Call
    const explanation = await generateEvaluation(data, decision, score);
    
    const finalSubmission = { ...newSubmission, aiExplanation: explanation };
    setCurrentSubmission(finalSubmission);
    
    // 5. Update Local State
    setSubmissions(prev => [finalSubmission, ...prev]);

    // 6. Save to Database
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentView={view} changeView={setView} isAdmin={isAdmin} />
      
      <main className="flex-grow flex flex-col">
        {view === ViewState.ASSESSMENT && <AssessmentPage onSubmit={handleAssessmentSubmit} />}
        {view === ViewState.RESULT && currentSubmission && <ResultPage submission={currentSubmission} onReset={() => setView(ViewState.ASSESSMENT)} onViewRules={() => setView(ViewState.RULES)} />}
        {view === ViewState.RULES && <RulesPage />}
        {view === ViewState.LOGIN && <LoginPage onLogin={handleLogin} />}
        {view === ViewState.ADMIN && <AdminPage submissions={submissions} />}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        <p>&copy; 2026 InfoVision. All rights reserved.</p>
      </footer>
    </div>
  );
}

// ==========================================
// PAGE 1: ASSESSMENT FORM
// ==========================================
const AssessmentPage = ({ onSubmit }: { onSubmit: (data: FormData) => void }) => {
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateScenario = async () => {
    setIsGenerating(true);
    // Visual feedback: Clear non-text fields temporarily or just re-render
    setFormData({}); 
    
    const scenario = await generateRandomScenario();
    if (scenario) {
      setFormData(scenario);
    } else {
      alert("Could not generate scenario. Please check your network or try again.");
    }
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple Validation
    const requiredFields: (keyof FormData)[] = ['projectName', 'projectDescription', 'dataPrivacy', 'latency', 'complexity', 'hardware', 'connectivity'];
    const isValid = requiredFields.every(field => !!formData[field]);
    
    if (!isValid) {
      alert("Please fill in all fields to proceed with the assessment.");
      return;
    }

    setIsSubmitting(true);
    onSubmit(formData as FormData);
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">SLM vs LLM Assessment</h1>
        <p className="text-lg text-slate-600">Answer the architectural constraints below to determine the optimal AI model strategy for your project.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-2 bg-indigo-600 w-full"></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          <div className="flex justify-end">
             <button 
              type="button" 
              onClick={handleGenerateScenario}
              disabled={isGenerating}
              className="text-indigo-600 hover:text-white text-sm font-medium hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 flex items-center bg-indigo-50 px-4 py-2 rounded-full transition-all duration-300"
             >
               {isGenerating ? (
                 <>
                   <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent mr-2"></div>
                   Dreaming up scenario...
                 </>
               ) : (
                 <>
                   <Sparkles className="w-4 h-4 mr-1.5" />
                   Generate AI Scenario
                 </>
               )}
             </button>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-500" />
              Project Context
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white text-slate-900"
                  placeholder="e.g. Enterprise Search V2"
                  value={formData.projectName || ''}
                  onChange={(e) => handleChange('projectName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Description</label>
                <textarea 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition h-24 resize-none bg-white text-slate-900"
                  placeholder="Briefly describe the use case..."
                  value={formData.projectDescription || ''}
                  onChange={(e) => handleChange('projectDescription', e.target.value)}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Questions */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center">
              <Server className="w-5 h-5 mr-2 text-indigo-500" />
              Technical Constraints
            </h2>
            
            {QUESTIONS.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-slate-700 mb-3">{q.label}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {q.options.map((opt) => (
                    <div 
                      key={opt.value}
                      onClick={() => handleChange(q.id as keyof FormData, opt.value)}
                      className={`cursor-pointer px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                        formData[q.id as keyof FormData] === opt.value
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex justify-center items-center text-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Analyzing...' : 'Generate Architectural Decision'}
              {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5" />}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 2: RESULT
// ==========================================
const ResultPage = ({ submission, onReset, onViewRules }: { submission: Submission, onReset: () => void, onViewRules: () => void }) => {
  const isLLM = submission.decision === ModelChoice.LLM;
  
  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-12 flex-grow flex flex-col justify-center">
      
      {/* Header Decision */}
      <div className={`text-center py-10 rounded-t-2xl ${isLLM ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'} text-white shadow-xl`}>
        <h2 className="text-xl font-medium opacity-90 mb-2">Recommended Architecture</h2>
        <h1 className="text-5xl font-bold tracking-tight mb-4">{isLLM ? 'LLM' : 'SLM'}</h1>
        <p className="text-2xl font-light opacity-90">{submission.decision}</p>
      </div>

      {/* AI Explanation Content */}
      <div className="bg-white rounded-b-2xl shadow-xl border-x border-b border-slate-200 p-8 sm:p-10 mb-8">
        <div className="flex items-start mb-6">
          <div className="bg-indigo-100 p-2 rounded-lg mr-4 mt-1">
            <Activity className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">Architectural Evaluation</h3>
            <p className="text-slate-500 text-sm">Powered by AI Analysis</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg">
          {submission.aiExplanation === "Analyzing constraints..." ? (
             <div className="animate-pulse flex space-x-4">
               <div className="flex-1 space-y-4 py-1">
                 <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                 <div className="h-4 bg-slate-200 rounded"></div>
                 <div className="h-4 bg-slate-200 rounded w-5/6"></div>
               </div>
             </div>
          ) : (
            <p>{submission.aiExplanation}</p>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-xs uppercase tracking-wide text-slate-400 font-semibold">Privacy Score</span>
            <span className="text-slate-800 font-medium">{submission.data.dataPrivacy.toUpperCase()}</span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-slate-400 font-semibold">Hardware Target</span>
            <span className="text-slate-800 font-medium">{submission.data.hardware.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        <button onClick={onReset} className="px-6 py-3 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium">
          Start New Assessment
        </button>
        <button onClick={onViewRules} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition font-medium">
          View Scoring Rules
        </button>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 3: RULES & INFO
// ==========================================
const RulesPage = () => {
  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-8 text-center">Decision Logic & Methodology</h1>
      
      {/* Logic Card - Full Width */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
          <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
          Scoring Logic
        </h2>
        <p className="text-slate-600 mb-6 text-sm">
          The assessment uses a weighted scoring system. Higher scores indicate a need for massive knowledge bases and reasoning (LLM), while lower scores favor efficiency and privacy (SLM).
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ul className="space-y-4">
              <li className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-700">Strict Privacy / PII</span>
                <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded">0 pts (SLM)</span>
              </li>
              <li className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-700">Reasoning / Creativity</span>
                <span className="text-xs font-mono bg-indigo-100 text-indigo-800 px-2 py-1 rounded">10 pts (LLM)</span>
              </li>
              <li className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-slate-700">Offline / Edge Hardware</span>
                <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-1 rounded">0 pts (SLM)</span>
              </li>
            </ul>
            <div className="flex flex-col justify-center items-center bg-slate-50 rounded-lg p-6">
               <span className="text-slate-900 font-semibold mb-2">LLM Threshold</span>
               <span className="text-3xl font-bold text-indigo-600">&gt; 25 Points</span>
               <p className="text-xs text-slate-500 mt-2 text-center max-w-xs">If the score exceeds 25, the complexity requires a Large Language Model. Otherwise, a Small Language Model is sufficient.</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* SLM Card */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
            <Cpu className="w-5 h-5 mr-2 text-emerald-600" />
            Why SLM? (Small Models)
          </h2>
          <p className="text-sm text-slate-500 mb-6 flex-grow">Best for specific tasks, privacy-focused apps, and edge devices.</p>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-emerald-600 font-bold mb-2">Pros</h3>
              <ul className="space-y-2">
                {['Ultra-low Latency (On-device)', 'Enhanced Data Privacy (No data egress)', 'Lower Operational Cost', 'Offline Capability'].map((item, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
             <div>
              <h3 className="text-xs uppercase tracking-wide text-red-500 font-bold mb-2">Cons</h3>
              <ul className="space-y-2">
                {['Limited General Knowledge', 'Weaker Complex Reasoning', 'Smaller Context Window'].map((item, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* LLM Card */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
            <BrainCircuit className="w-5 h-5 mr-2 text-purple-600" />
            Why LLM? (Large Models)
          </h2>
          <p className="text-sm text-slate-500 mb-6 flex-grow">Best for complex reasoning, creative generation, and broad knowledge.</p>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-purple-600 font-bold mb-2">Pros</h3>
              <ul className="space-y-2">
                {['Massive General Knowledge', 'Advanced Reasoning & Logic', 'High Creativity & nuance', 'Large Context Window'].map((item, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
             <div>
              <h3 className="text-xs uppercase tracking-wide text-red-500 font-bold mb-2">Cons</h3>
              <ul className="space-y-2">
                {['High Latency / Slow', 'Data Privacy Risks (Cloud)', 'Expensive to Run (GPUs)', 'Requires Internet'].map((item, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-700">
                    <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@infovision.com' && password === '$Infovision2026$') {
      onLogin(true);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl border border-slate-200 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
            <Lock className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Please sign in to view submission analytics.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition shadow-md"
          >
            Secure Login
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// PAGE 5: ADMIN DASHBOARD (SPLIT VIEW)
// ==========================================
const AdminPage = ({ submissions }: { submissions: Submission[] }) => {
  const [selectedId, setSelectedId] = useState<string>(submissions[0]?.id || '');

  const selectedSubmission = submissions.find(s => s.id === selectedId);

  return (
    <div className="flex-grow flex overflow-hidden h-[calc(100vh-64px)]">
      {/* LEFT PANE: LIST (30%) */}
      <div className="w-[30%] bg-white border-r border-slate-200 overflow-y-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <h2 className="font-bold text-slate-700">Recent Assessments</h2>
          <span className="text-xs text-slate-500">{submissions.length} total records</span>
        </div>
        <div>
          {submissions.map((sub) => (
            <div 
              key={sub.id}
              onClick={() => setSelectedId(sub.id)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedId === sub.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-slate-800 truncate pr-2">{sub.user}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${sub.decision === ModelChoice.LLM ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {sub.decision === ModelChoice.LLM ? 'LLM' : 'SLM'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-1 truncate">{sub.data.projectName}</p>
              <p className="text-[10px] text-slate-400">{sub.timestamp.toLocaleDateString()} {sub.timestamp.toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANE: DETAIL (70%) */}
      <div className="w-[70%] bg-slate-50 overflow-y-auto p-8">
        {selectedSubmission ? (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{selectedSubmission.data.projectName}</h1>
                    <p className="text-slate-500 text-sm mt-1">{selectedSubmission.user}</p>
                </div>
                <div className={`px-4 py-2 rounded-lg text-center ${selectedSubmission.decision === ModelChoice.LLM ? 'bg-purple-600' : 'bg-emerald-500'} text-white`}>
                    <p className="text-xs opacity-80 uppercase font-semibold">Result</p>
                    <p className="font-bold">{selectedSubmission.decision === ModelChoice.LLM ? 'LLM' : 'SLM'}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm text-slate-700 border border-slate-100">
                <span className="font-semibold block mb-1">Description:</span>
                {selectedSubmission.data.projectDescription}
              </div>

               <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">AI Analysis</h3>
               <div className="prose prose-sm text-slate-600 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                 {selectedSubmission.aiExplanation}
               </div>
            </div>

            {/* Form Data Read-only */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Submitted Constraints</h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    {Object.entries(selectedSubmission.data).map(([key, value]) => {
                        if (key === 'projectName' || key === 'projectDescription') return null;
                        const q = QUESTIONS.find(q => q.id === key);
                        const label = q ? q.label : key;
                        const opt = q?.options.find(o => o.value === value);
                        
                        return (
                            <div key={key}>
                                <span className="block text-xs text-slate-400 uppercase font-bold">{label}</span>
                                <span className="text-slate-800 font-medium text-sm">{opt ? opt.label : String(value)}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            Select a submission to view details
          </div>
        )}
      </div>
    </div>
  );
}