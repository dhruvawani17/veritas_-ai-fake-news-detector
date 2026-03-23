/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { analyzeNews, AnalysisResult } from './services/geminiService';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Newspaper, 
  ShieldCheck, 
  Loader2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeNews(input);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred while analyzing the content. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'True': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'Mostly True': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'Mixed': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'Mostly Fake': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'Fake': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Veritas AI</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Fake News Detector</p>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">How it works</a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">Methodology</a>
            <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all">
              API Access
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-7 space-y-8">
            <section>
              <h2 className="text-3xl font-bold tracking-tight mb-3">Analyze News Content</h2>
              <p className="text-slate-500 leading-relaxed">
                Paste a news article, headline, or claim below. Our AI will analyze logical fallacies, source credibility, and bias patterns.
              </p>
            </section>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-focus-within:opacity-25 transition duration-1000"></div>
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste article text or a claim here..."
                  className="w-full h-64 p-6 text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none text-lg leading-relaxed"
                />
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-slate-400">
                    <button className="hover:text-indigo-600 transition-colors"><Info size={18} /></button>
                    <span className="text-xs font-medium">{input.length} characters</span>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !input.trim()}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-sm",
                      isAnalyzing || !input.trim() 
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:shadow-lg active:scale-95"
                    )}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Detect Veracity
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600"
              >
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                  <Newspaper className="text-blue-600 w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Source Analysis</h3>
                <p className="text-xs text-slate-500">Cross-references with known credible news databases.</p>
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
                  <Scale className="text-purple-600 w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Bias Detection</h3>
                <p className="text-xs text-slate-500">Identifies emotional manipulation and political leaning.</p>
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Score Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-500 uppercase tracking-wider text-xs">Veracity Score</h3>
                        <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", getVerdictColor(result.verdict))}>
                          {result.verdict}
                        </span>
                      </div>
                      
                      <div className="flex items-end gap-4 mb-4">
                        <span className="text-6xl font-black tracking-tighter">{result.score}</span>
                        <span className="text-slate-400 font-medium mb-2">/ 100</span>
                      </div>

                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${result.score}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={cn("h-full rounded-full", getScoreColor(result.score))}
                        />
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/50">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="text-amber-500 w-4 h-4" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Key Red Flags</h4>
                      </div>
                      <ul className="space-y-3">
                        {result.redFlags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Bias Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Scale className="text-indigo-600 w-4 h-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Bias Analysis</h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed italic">
                      "{result.bias}"
                    </p>
                  </div>

                  {/* Detailed Analysis */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="text-slate-400 w-4 h-4" />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">AI Reasoning</h4>
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>{result.reasoning}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Sources Card */}
                  {result.sources && result.sources.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <ExternalLink className="text-blue-500 w-4 h-4" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Verified Sources</h4>
                      </div>
                      <div className="space-y-3">
                        {result.sources.map((source, i) => (
                          <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                          >
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              <span className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                                {source.title || 'Source Link'}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {new URL(source.uri).hostname}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => { setInput(''); setResult(null); }}
                    className="w-full py-3 text-slate-500 text-sm font-medium hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    Clear and start new analysis
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                    <Newspaper className="text-slate-300 w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-400 mb-2">No Analysis Yet</h3>
                  <p className="text-sm text-slate-400 max-w-[240px]">
                    Enter some content on the left to begin the verification process.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 bg-white">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold text-sm">Veritas AI</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-400">
            <a href="#" className="hover:text-slate-600">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600">Terms of Service</a>
            <a href="#" className="hover:text-slate-600">Contact Support</a>
          </div>
          <p className="text-xs text-slate-400">© 2026 Veritas AI. Powered by Gemini 3.1 Pro.</p>
        </div>
      </footer>
    </div>
  );
}
