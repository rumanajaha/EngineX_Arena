"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";
import * as Dialog from "@radix-ui/react-dialog";
import { useToast } from "@/components/providers/ToastProvider";

interface Challenge {
  id: string;
  mode: string;
  title: string;
  description: string;
  difficulty: string;
  brokenCode: string | null;
  slowCode: string | null;
  benchmarkMs: number | null;
  designPrompt: string | null;
  testCases: unknown;
}

interface TestCaseResult {
  testCaseIndex: number;
  input: string;
  expected: string;
  output: string;
  passed: boolean;
  timeTakenMs: number;
  error: string;
}

const nodeColors: Record<string, string> = {
  Client: "bg-blue-900 border-blue-400 text-blue-100",
  Server: "bg-purple-900 border-purple-400 text-purple-100",
  Database: "bg-red-900 border-red-400 text-red-100",
  Cache: "bg-green-900 border-green-400 text-green-100",
  Queue: "bg-yellow-900 border-yellow-400 text-yellow-100",
  CDN: "bg-pink-900 border-pink-400 text-pink-100",
};

export default function SoloChallengePage() {
  const { challengeId } = useParams() as { challengeId: string };
  const { data: session } = useSession();
  const router = useRouter();
  const player = session?.player;
  const { showToast } = useToast();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Timer: 10 minutes = 600 seconds
  const [timeLeft, setTimeLeft] = useState(600);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Code state
  const [code, setCode] = useState("");
  // Arch Wars state
  const [archDescription, setArchDescription] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Execution outputs
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optNewMs, setOptNewMs] = useState<number | null>(null);

  // Result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalTimeTakenMs, setFinalTimeTakenMs] = useState(0);
  const [rankBadge, setRankBadge] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  // Fetch challenge details
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/challenges/${challengeId}`);
        if (!res.ok) {
          showToast("Error", "Failed to retrieve challenge details.", "error");
          router.push("/hub");
          return;
        }
        const data = await res.json();
        setChallenge(data);

        // Preload editor templates
        if (data.brokenCode) {
          setCode(data.brokenCode);
        } else if (data.slowCode) {
          setCode(data.slowCode);
        }
      } catch (err) {
        console.error("Error loading challenge:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeId, router, showToast]);

  // Complete practice run: save submission outcome to database
  const completePractice = useCallback(async (score: number, timeTakenMs: number, submission: unknown) => {
    if (!player) return;
    try {
      const res = await fetch("/api/solo/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          playerId: player.id,
          score,
          timeTakenMs,
          submission,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFinalScore(score);
        setFinalTimeTakenMs(timeTakenMs);
        setRankBadge(data.rank);
        setResultMessage(data.message);
        setShowResultModal(true);
      } else {
        showToast("Error", "Failed to register practicing stats in database.", "error");
      }
    } catch (err) {
      console.error("Solo practice complete API failed:", err);
    }
  }, [challengeId, player, showToast]);

  // Handle countdown complete
  const handleTimesUp = useCallback(async () => {
    showToast("Time's Up!", "The timer has expired. Submitting practices.", "error");
    // Auto complete with score 0
    await completePractice(0, 600000, "");
  }, [showToast, completePractice]);

  // Countdown timer logic
  useEffect(() => {
    if (isLoading || !challenge) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleTimesUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isLoading, challenge, handleTimesUp]);

  // React Flow node addition
  const addNode = (type: string) => {
    const id = (nodes.length + 1).toString();
    const newNode: Node = {
      id,
      data: { label: type },
      position: { x: Math.random() * 200 + 100, y: Math.random() * 150 + 50 },
      className: `border-2 font-mono font-bold px-4 py-2 rounded-lg shadow-md ${
        nodeColors[type] || "bg-surface text-cream"
      }`,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Submit Practice Run Handler
  const handleSubmit = async () => {
    if (!challenge || !player || isSubmitting) return;
    setIsSubmitting(true);

    const timeTakenSeconds = 600 - timeLeft;
    const timeTakenMs = timeTakenSeconds * 1000;

    try {
      if (challenge.mode === "SYSTEM_CRASH") {
        const judgeRes = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            challengeId: challenge.id,
          }),
        });

        if (judgeRes.ok) {
          const judgeData = await judgeRes.json();
          setTestResults(judgeData.results || []);

          if (judgeData.success) {
            // Success: score based on time taken (max 1000 points, decr by 1.5 points per second elapsed)
            const calculatedScore = Math.max(100, Math.round(1000 - timeTakenSeconds * 1.5));
            showToast("Success!", `All test cases passed. Practice score: ${calculatedScore}`, "success");
            await completePractice(calculatedScore, timeTakenMs, code);
          } else {
            showToast("Failed Verification", "Some test cases failed or output compilations failed.", "error");
          }
        } else {
          showToast("Error", "Failed to judge code correctness.", "error");
        }
      } else if (challenge.mode === "LOAD_BREAKER") {
        const judgeRes = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            challengeId: challenge.id,
            isOptimization: true,
          }),
        });

        if (judgeRes.ok) {
          const judgeData = await judgeRes.json();
          setOptNewMs(judgeData.newMs);

          if (judgeData.success) {
            const calculatedScore = judgeData.score || 0;
            showToast("Optimized!", `Execution time: ${judgeData.newMs}ms. Score: ${calculatedScore}`, "success");
            await completePractice(calculatedScore, timeTakenMs, code);
          } else {
            showToast("Failed Optimization", "Compilation or verification error.", "error");
          }
        } else {
          showToast("Error", "Failed to compile optimization code.", "error");
        }
      } else if (challenge.mode === "ARCH_WARS") {
        // AI architecture evaluation
        const scoreRes = await fetch("/api/score-arch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textarea: archDescription,
            architectureJson: { nodes, edges },
          }),
        });

        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          const calculatedScore = scoreData.score || 0;
          showToast("Submitted Design", `AI evaluation completed. Design score: ${calculatedScore}`, "success");
          await completePractice(calculatedScore, timeTakenMs, {
            textarea: archDescription,
            architectureJson: { nodes, edges },
          });
        } else {
          showToast("Error", "Failed to score architecture blueprint.", "error");
        }
      }
    } catch (err) {
      console.error("Submitting practicing code failed:", err);
      showToast("Error", "Failed to evaluate practicing code solution.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rematch or try challenge again
  const handleTryAgain = () => {
    setTimeLeft(600);
    setTestResults([]);
    setOptNewMs(null);
    setShowResultModal(false);
    if (challenge?.brokenCode) {
      setCode(challenge.brokenCode);
    } else if (challenge?.slowCode) {
      setCode(challenge.slowCode);
    }
    setArchDescription("");
    setNodes([]);
    setEdges([]);
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getRelativeTimeDisplay = (ms: number) => {
    const sec = Math.round(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (isLoading || !challenge) {
    return (
      <div className="h-full w-full bg-bg text-cream flex flex-col items-center justify-center font-mono text-sm">
        <svg className="w-8 h-8 text-sand animate-spin mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
        </svg>
        ESTABLISHING PRACTICE TERMINAL PORT LINK...
      </div>
    );
  }

  const isLowTime = timeLeft < 120; // Red indicator below 2 minutes

  return (
    <div className="h-full w-full bg-bg text-cream flex flex-col overflow-hidden font-sans relative">
      {/* Sci-Fi glowing grid decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(87,74,36,0.1),transparent_60%)] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="h-16 border-b border-khaki/10 bg-surface/80 backdrop-blur-md flex justify-between items-center px-8 z-20 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span className="bg-sand text-bg px-2.5 py-0.5 rounded text-[10px] font-space font-bold uppercase tracking-wider">
            Practice
          </span>
          <div>
            <h3 className="font-space text-base font-bold text-cream leading-normal uppercase">
              {challenge.title}
            </h3>
            <span className="text-[9px] font-mono text-khaki bg-surface2 border border-khaki/10 px-1.5 py-0.25 rounded uppercase">
              Difficulty: {challenge.difficulty}
            </span>
          </div>
        </div>

        {/* Timer countdown */}
        <div className="flex flex-col items-center">
          <div
            className={`border rounded px-3 py-1 font-mono text-sm font-semibold transition ${
              isLowTime
                ? "bg-red-950/20 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                : "bg-bg border-khaki/25 text-sand"
            }`}
          >
            {formatCountdown(timeLeft)}
          </div>
          <span className="text-[8px] font-mono uppercase text-khaki mt-1 tracking-wider">
            Practice Time Left
          </span>
        </div>

        {/* Action / Player profile */}
        <div className="flex items-center space-x-6">
          {player && (
            <div className="flex items-center space-x-2.5">
              <img src={player.avatar} alt={player.username} className="w-8 h-8 rounded-lg border border-khaki/20" />
              <span className="font-space text-xs font-semibold text-cream hidden sm:inline">{player.username}</span>
            </div>
          )}
          <button
            onClick={() => router.push("/hub")}
            className="border border-red-500/30 hover:border-red-500 bg-red-950/10 hover:bg-red-950/30 text-red-400 px-4 py-1.5 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer"
          >
            Give Up
          </button>
        </div>
      </header>

      {/* Main workspaces */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* SYSTEM_CRASH WORKSPACE */}
        {challenge.mode === "SYSTEM_CRASH" && (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Editor Left */}
            <div className="w-1/2 border-r border-khaki/10 flex flex-col bg-bg h-full">
              <div className="h-10 bg-surface/50 border-b border-khaki/10 flex items-center px-4 justify-between flex-shrink-0">
                <span className="font-mono text-xs text-khaki">SYSTEM_CRASH_FIX.JS</span>
              </div>
              <div className="flex-1 relative min-h-0">
                <Editor
                  theme="vs-dark"
                  language="javascript"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            {/* Problem & Test Cases Right */}
            <div className="w-1/2 flex flex-col bg-surface/10 overflow-y-auto p-8 space-y-6 h-full">
              <div>
                <h3 className="font-space text-xl font-bold tracking-tight text-cream mb-2">Instructions</h3>
                <p className="text-xs text-khaki leading-relaxed whitespace-pre-wrap">{challenge.description}</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-space text-xs font-bold uppercase tracking-wider text-sand">Evaluation Suite</h4>
                {testResults.length === 0 ? (
                  <div className="border border-khaki/10 bg-surface/20 rounded-xl p-6 text-center font-mono text-xs text-khaki">
                    NO EXECUTIONS LOGGED. CLICK SUBMIT TO EXECUTE CODE AND VALIDATE TEST CASES.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {testResults.map((tr) => (
                      <div
                        key={tr.testCaseIndex}
                        className={`border rounded-xl p-4 flex flex-col space-y-2 ${
                          tr.passed
                            ? "bg-green-950/20 border-green-500/20 text-green-300"
                            : "bg-red-950/20 border-red-500/20 text-red-300"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                          <span>TEST CASE #{tr.testCaseIndex + 1}</span>
                          <span className={tr.passed ? "text-green-400" : "text-red-400"}>
                            {tr.passed ? "PASSED" : "FAILED"} ({tr.timeTakenMs}ms)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-khaki">
                          <div>Input: <span className="text-cream">{tr.input}</span></div>
                          <div>Expected: <span className="text-cream">{tr.expected}</span></div>
                        </div>
                        {tr.error && (
                          <div className="bg-bg border border-red-500/10 rounded p-2 text-red-400 text-[10px] font-mono">
                            Error: {tr.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOAD_BREAKER WORKSPACE */}
        {challenge.mode === "LOAD_BREAKER" && (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Slow code benchmark parameters reference */}
            <div className="w-1/3 border-r border-khaki/10 flex flex-col p-6 bg-surface/5 space-y-6 overflow-y-auto h-full">
              <div>
                <h3 className="font-space text-lg font-bold text-cream mb-2">Performance Criteria</h3>
                <p className="text-xs text-khaki leading-relaxed">{challenge.description}</p>
              </div>

              <div className="bg-surface border border-khaki/15 rounded-xl p-4 font-mono text-[10px] space-y-2">
                <span className="text-[9px] text-khaki uppercase tracking-wider block font-bold">Execution Threshold</span>
                <div className="flex justify-between border-b border-khaki/10 py-1">
                  <span>Complexity Benchmark:</span>
                  <span className="text-sand">Sub-O(n²) optimal</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Target Execution Speed:</span>
                  <span className="text-sand">&lt; {challenge.benchmarkMs}ms</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <span className="font-mono text-[10px] text-khaki mb-2 uppercase block font-bold">SLOW_IMPLEMENTATION.JS</span>
                <div className="flex-1 relative border border-khaki/15 rounded-xl overflow-hidden min-h-[180px]">
                  <Editor
                    theme="vs-dark"
                    language="javascript"
                    value={challenge.slowCode || ""}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 11,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Monaco Editor Optimized Code Input */}
            <div className="flex-1 flex flex-col bg-bg h-full min-h-0">
              <div className="h-10 bg-surface/50 border-b border-khaki/10 flex items-center px-4 justify-between flex-shrink-0">
                <span className="font-mono text-xs text-khaki">OPTIMIZED_IMPLEMENTATION.JS</span>
              </div>
              <div className="flex-1 relative min-h-0">
                <Editor
                  theme="vs-dark"
                  language="javascript"
                  value={code}
                  onChange={(val) => setCode(val || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                  }}
                />
              </div>
              {optNewMs !== null && (
                <div className="p-4 border-t border-khaki/10 bg-surface/20 font-mono text-xs text-sand">
                  Latest optimization run speed: {optNewMs}ms
                </div>
              )}
            </div>
          </div>
        )}

        {/* ARCH_WARS WORKSPACE */}
        {challenge.mode === "ARCH_WARS" && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="p-6 border-b border-khaki/10 bg-surface/30 flex-shrink-0">
              <h3 className="font-space text-base font-bold tracking-tight text-cream mb-1">Topology Specifications</h3>
              <p className="text-xs text-khaki leading-relaxed">{challenge.designPrompt}</p>
            </div>

            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Written description textarea */}
              <div className="w-1/3 border-r border-khaki/10 flex flex-col p-6 space-y-4 bg-bg h-full">
                <label className="font-space text-xs font-bold uppercase tracking-wider text-sand">Design Document</label>
                <textarea
                  value={archDescription}
                  onChange={(e) => setArchDescription(e.target.value)}
                  placeholder="Detail client-server communication limits, queue buffer thresholds, data replications, and rate limit architectures..."
                  className="flex-1 bg-surface border border-khaki/20 text-cream p-4 rounded-xl text-xs focus:outline-none focus:border-sand resize-none leading-relaxed"
                />
              </div>

              {/* React Flow topology design area */}
              <div className="flex-1 flex flex-col bg-surface/5 h-full min-h-0">
                <div className="h-12 bg-surface border-b border-khaki/10 flex items-center px-6 space-x-2 flex-shrink-0">
                  <span className="font-space text-[10px] font-bold text-khaki mr-4 uppercase">Nodes:</span>
                  {["Client", "Server", "Database", "Cache", "Queue", "CDN"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addNode(type)}
                      className="bg-surface2 border border-khaki/25 hover:border-sand text-cream px-2.5 py-1.5 rounded text-[9px] font-space font-bold uppercase tracking-wide cursor-pointer"
                    >
                      + {type}
                    </button>
                  ))}
                </div>
                <div className="flex-1 relative min-h-0">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                  >
                    <Background color="#CBBD93" gap={16} size={1} />
                    <Controls className="bg-surface border border-khaki/30 text-cream rounded" />
                  </ReactFlow>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FIXED SUBMIT SOLUTION BUTTON AT BOTTOM RIGHT */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-cream hover:bg-sand text-bg px-6 py-3 rounded-xl font-space font-bold uppercase text-xs tracking-wider shadow-2xl transition duration-200 cursor-pointer disabled:opacity-50 flex items-center space-x-2"
        >
          {isSubmitting && (
            <svg className="w-3.5 h-3.5 animate-spin text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
            </svg>
          )}
          <span>{isSubmitting ? "Judging..." : "Submit Solution"}</span>
        </button>
      </div>

      {/* RESULTS DISPLAY POPUP OVERLAY */}
      <Dialog.Root open={showResultModal} onOpenChange={setShowResultModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/25 p-8 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60 flex-shrink-0" />

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 pb-4 text-center">
                {/* Result Title */}
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-olive/20 border border-sand flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(203,189,147,0.25)] text-sand">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <Dialog.Title className="font-space text-2xl font-extrabold tracking-wider text-cream uppercase">
                    PRACTICE COMPLETE
                  </Dialog.Title>
                  <p className="text-xs text-khaki font-mono leading-relaxed">{resultMessage}</p>
                </div>

                {/* Score & Time Metrics */}
                <div className="bg-bg border border-khaki/10 rounded-xl p-4 flex justify-around items-center my-6">
                  <div>
                    <span className="block text-[9px] text-khaki font-mono uppercase tracking-wider">Score</span>
                    <span className="text-xl font-bold font-mono text-sand">
                      {finalScore} / 1000
                    </span>
                  </div>
                  <div className="w-[1px] h-8 bg-khaki/15" />
                  <div>
                    <span className="block text-[9px] text-khaki font-mono uppercase tracking-wider">Time taken</span>
                    <span className="text-xl font-bold font-mono text-cream">
                      {getRelativeTimeDisplay(finalTimeTakenMs)}
                    </span>
                  </div>
                  <div className="w-[1px] h-8 bg-khaki/15" />
                  <div>
                    <span className="block text-[9px] text-khaki font-mono uppercase tracking-wider">ELO Rank</span>
                    <span className="text-xs font-bold font-space text-cream bg-surface2 border border-khaki/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      {rankBadge || "Gold"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions sticky footer */}
              <div className="flex flex-col space-y-2.5 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                <button
                  onClick={() => {
                    showToast("Score Shared", "Your practice performance has been synced to the rankings feed.", "success");
                  }}
                  className="w-full bg-surface border border-khaki/20 hover:border-khaki/40 text-cream py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Share to Leaderboard
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={handleTryAgain}
                    className="w-1/2 border border-khaki/20 hover:border-khaki/40 text-cream py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => router.push("/hub")}
                    className="w-1/2 bg-cream text-bg py-3 rounded-xl font-space font-bold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                  >
                    Back to Hub
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
