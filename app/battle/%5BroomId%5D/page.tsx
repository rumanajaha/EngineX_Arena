"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
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
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import SocketConnectionBoundary from "@/components/SocketConnectionBoundary";
import { useToast } from "@/components/providers/ToastProvider";

interface Player {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
}

interface Battle {
  id: string;
  roomId: string;
  mode: string;
  status: string;
  player1: Player;
  player2: Player | null;
}

interface Challenge {
  id: string;
  mode: string;
  title: string;
  description: string;
  brokenCode: string | null;
  slowCode: string | null;
  benchmarkMs: number | null;
  designPrompt: string | null;
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

export default function BattleRoomPage() {
  const { roomId } = useParams() as { roomId: string };
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.player;
  const { showToast } = useToast();

  // Battle state
  const [battle, setBattle] = useState<Battle | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [opponent, setOpponent] = useState<Player | null>(null);
  
  // Timer
  const [timer, setTimer] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // Statuses
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [meSubmitted, setMeSubmitted] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Mode: SYSTEM_CRASH
  const [crashCode, setCrashCode] = useState("");
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);

  // Mode: ARCH_WARS
  const [archDescription, setArchDescription] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Voting & scoring states for ARCH_WARS
  const [archVoteSubmitted, setArchVoteSubmitted] = useState(false);
  const [archPeerVotes, setArchPeerVotes] = useState(0);
  const [archAIScore, setArchAIScore] = useState<number | null>(null);
  const [archOpponentDescription, setArchOpponentDescription] = useState("");
  const [archOpponentNodes, setArchOpponentNodes] = useState<Node[]>([]);
  const [archOpponentEdges] = useState<Edge[]>([]);
  const [archAIFeedback, setArchAIFeedback] = useState("");

  // Mode: LOAD_BREAKER
  const [optCode, setOptCode] = useState("");
  const [optOriginalMs, setOptOriginalMs] = useState(120);
  const [optNewMs, setOptNewMs] = useState<number | null>(null);
  const [optMyScore, setOptMyScore] = useState<number | null>(null);
  const [optOpponentScore, setOptOpponentScore] = useState<number | null>(null);

  // Result overlay
  const [showResultModal, setShowResultModal] = useState(false);
  const [battleWinnerId, setBattleWinnerId] = useState<string | null>(null);
  const [eloWinnerChange, setEloWinnerChange] = useState(30);
  const [eloLoserChange, setEloLoserChange] = useState(20);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false);

  // Fetch battle details
  const fetchBattleDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setBattle(data.battle);
        setChallenge(data.challenge);
        
        // Identify opponent
        if (me) {
          const isMeP1 = data.battle.player1Id === me.id;
          setOpponent(isMeP1 ? data.battle.player2 : data.battle.player1);
        }

        // Initialize editor codes
        if (data.challenge.brokenCode) {
          setCrashCode(data.challenge.brokenCode);
        }
        if (data.challenge.slowCode) {
          setOptCode(data.challenge.slowCode);
          setOptOriginalMs(data.challenge.benchmarkMs || 120);
        }
      }
    } catch (err) {
      console.error("Error loading battle:", err);
    }
  }, [roomId, me]);

  useEffect(() => {
    if (me) {
      fetchBattleDetails();
    }
  }, [me, fetchBattleDetails]);

  // Handle socket setup
  useEffect(() => {
    if (!me || !battle) return;

    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.emit("join:battle", { roomId, playerId: me.id });

    socket.on("player:typing_update", (data: { playerId: string; isTyping: boolean }) => {
      if (data.playerId !== me.id) {
        setOpponentTyping(data.isTyping);
      }
    });

    socket.on("player:submitted_update", (data: { playerId: string; score?: number }) => {
      if (data.playerId !== me.id) {
        setOpponentSubmitted(true);
        setOpponentTyping(false);
        if (data.score !== undefined) {
          setOptOpponentScore(data.score);
        }
      }
    });

    socket.on("load_breaker:score_update", (data: { playerId: string; score: number }) => {
      if (data.playerId !== me.id) {
        setOptOpponentScore(data.score);
      }
    });

    socket.on("battle:result_update", (data: { winnerId: string; winnerChange: number; loserChange: number }) => {
      setBattleWinnerId(data.winnerId);
      setEloWinnerChange(data.winnerChange);
      setEloLoserChange(data.loserChange);
      setShowResultModal(true);
      if (me) {
        if (data.winnerId === me.id) {
          showToast("Victory!", `You won and gained +${data.winnerChange} ELO rating!`, "success");
        } else {
          showToast("Defeat", `You lost and dropped -${data.loserChange} ELO rating.`, "error");
        }
      }
    });

    socket.on("rematch:request_received", (data: { playerId: string }) => {
      if (data.playerId !== me.id) {
        setOpponentRematchRequested(true);
      }
    });

    // Start timer counting up
    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => {
      socket.disconnect();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [battle, me, roomId, showToast]);

  // Opponent typing trigger
  const handleEditorChange = () => {
    if (!socketRef.current || !me) return;

    socketRef.current.emit("player:typing", {
      roomId,
      playerId: me.id,
      isTyping: true,
    });

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      socketRef.current?.emit("player:typing", {
        roomId,
        playerId: me.id,
        isTyping: false,
      });
    }, 1500);

    setTypingTimeout(timeout);
  };

  // Submit Fix for SYSTEM_CRASH
  const handleSubmitCrashFix = async () => {
    if (!challenge || isSubmittingFix || !me) return;
    setIsSubmittingFix(true);

    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: crashCode,
          challengeId: challenge.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResults(data.results || []);

        if (data.success) {
          setMeSubmitted(true);
          showToast("Tests Passed!", "All test cases resolved successfully.", "success");
          // Emit player:submitted with timeTakenMs
          socketRef.current?.emit("player:submitted", {
            roomId,
            playerId: me.id,
          });

          // If opponent already submitted, calculate result
          if (opponentSubmitted) {
            handleCompleteBattle(me.id); // Defaulting winner to the faster solver (me)
          }
        } else {
          showToast("Failed Verification", "Some test cases failed or compiled with errors.", "error");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFix(false);
    }
  };

  // Submit Optimization for LOAD_BREAKER
  const handleSubmitOptimization = async () => {
    if (!challenge || isSubmittingFix || !me) return;
    setIsSubmittingFix(true);

    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: optCode,
          challengeId: challenge.id,
          isOptimization: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOptNewMs(data.newMs);
        setOptMyScore(data.score);
        setMeSubmitted(true);
        showToast("Optimized!", `Execution time: ${data.newMs}ms. Score: ${data.score}/100`, "success");

        socketRef.current?.emit("player:submitted", {
          roomId,
          playerId: me.id,
          score: data.score,
        });

        socketRef.current?.emit("load_breaker:score", {
          roomId,
          playerId: me.id,
          score: data.score,
        });

        // Trigger finish if opponent has also submitted
        if (opponentSubmitted) {
          const finalOpponentScore = optOpponentScore || 0;
          const winnerId = data.score >= finalOpponentScore ? me.id : (opponent?.id || me.id);
          handleCompleteBattle(winnerId);
        }
      } else {
        showToast("Optimization Failed", "Compilation or verification error.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFix(false);
    }
  };

  // Submit Architecture for ARCH_WARS
  const handleSubmitArchitecture = async () => {
    if (!challenge || !me) return;

    try {
      const res = await fetch("/api/score-arch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textarea: archDescription,
          architectureJson: { nodes, edges },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setArchAIScore(data.score);
        setArchAIFeedback(data.feedback);
        setMeSubmitted(true);
        showToast("Design Submitted", `Architecture design uploaded. AI score: ${data.score}`, "success");

        socketRef.current?.emit("player:submitted", {
          roomId,
          playerId: me.id,
        });

        // Simulating mock opponent data load for comparison
        setArchOpponentDescription("Opponent architecture uses a CDN paired with multiple database replicas. Load balancing distributes traffic effectively across regions.");
        setArchOpponentNodes([
          { id: "1", type: "default", data: { label: "Client" }, position: { x: 50, y: 100 } },
          { id: "2", type: "default", data: { label: "CDN" }, position: { x: 200, y: 100 } },
          { id: "3", type: "default", data: { label: "Server" }, position: { x: 350, y: 100 } },
          { id: "4", type: "default", data: { label: "Database" }, position: { x: 500, y: 100 } },
        ]);

        if (opponentSubmitted) {
          // If opponent submitted, evaluate winner based on AI score
          const finalAIScore = data.score;
          const finalOpponentScore = Math.floor(Math.random() * 20) + 75; // mock opponent score
          const winnerId = finalAIScore >= finalOpponentScore ? me.id : (opponent?.id || me.id);
          handleCompleteBattle(winnerId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Complete Battle API
  const handleCompleteBattle = async (winnerId: string) => {
    try {
      const res = await fetch("/api/battles/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battleId: battle?.id,
          winnerId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        socketRef.current?.emit("battle:result", {
          roomId,
          winnerId: data.winnerId,
          winnerChange: data.winnerChange,
          loserChange: data.loserChange,
        });
      }
    } catch (err) {
      console.error("Error completing battle:", err);
    }
  };

  // Peer voting upvote choice
  const handleVoteDesign = (voteForMe: boolean) => {
    setArchVoteSubmitted(true);
    if (voteForMe) {
      setArchPeerVotes((prev) => prev + 1);
    }
    // Update ELO after votes if needed or just trigger finish
  };

  // Add React Flow Node
  const addNode = (type: string) => {
    const id = (nodes.length + 1).toString();
    const newNode: Node = {
      id,
      data: { label: type },
      position: { x: Math.random() * 200 + 100, y: Math.random() * 150 + 50 },
      className: `border-2 font-mono font-bold px-4 py-2 rounded-lg shadow-md ${nodeColors[type] || "bg-surface text-cream"}`,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleRematchRequest = () => {
    setRematchRequested(true);
    socketRef.current?.emit("rematch:request", { roomId, playerId: me?.id });

    // Auto trigger rematch reload if both clicked
    if (opponentRematchRequested) {
      router.push(`/lobby`); // redirect back to establish clean state or reload
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <SocketConnectionBoundary>
      <div className="h-full w-full bg-bg text-cream flex flex-col overflow-hidden font-sans relative">
      {/* Dynamic Top bar */}
      <header className="h-16 border-b border-khaki/10 bg-surface/80 backdrop-blur-md flex justify-between items-center px-8 z-20">
        {/* Me */}
        {me && (
          <div className="flex items-center space-x-3">
            <img src={me.avatar} alt={me.username} className="w-9 h-9 rounded-lg border border-khaki/20" />
            <div>
              <p className="font-space text-sm font-semibold">{me.username}</p>
              <p className="text-[10px] text-khaki font-mono">ELO: {me.eloRating}</p>
            </div>
            {meSubmitted && (
              <span className="bg-green-950 border border-green-500 text-green-400 text-[8px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
                Submitted
              </span>
            )}
          </div>
        )}

        {/* Middle Stats */}
        <div className="flex flex-col items-center">
          <div className="bg-bg border border-khaki/25 rounded px-3 py-1 font-mono text-sm font-semibold text-sand">
            {formatTime(timer)}
          </div>
          {battle && (
            <span className="bg-surface2 border border-khaki/10 text-[8px] px-2 py-0.5 mt-1 rounded-full font-space font-bold uppercase text-khaki tracking-widest">
              {battle.mode.replace("_", " ")}
            </span>
          )}
        </div>

        {/* Opponent */}
        {opponent ? (
          <div className="flex items-center space-x-3 text-right">
            {opponentSubmitted && (
              <span className="bg-green-950 border border-green-500 text-green-400 text-[8px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
                Submitted
              </span>
            )}
            {opponentTyping && !opponentSubmitted && (
              <span className="text-[9px] font-mono text-sand animate-pulse">
                Opponent is typing...
              </span>
            )}
            <div>
              <p className="font-space text-sm font-semibold">{opponent.username}</p>
              <p className="text-[10px] text-khaki font-mono">ELO: {opponent.eloRating}</p>
            </div>
            <img src={opponent.avatar} alt={opponent.username} className="w-9 h-9 rounded-lg border border-khaki/20" />
          </div>
        ) : (
          <div className="font-mono text-xs text-khaki animate-pulse">Waiting for challenger...</div>
        )}
      </header>

      {/* Main Workspace based on mode */}
      <div className="flex-1 flex overflow-hidden">
        {challenge && battle && (
          <>
            {/* SYSTEM CRASH MODE */}
            {battle.mode === "SYSTEM_CRASH" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Editor Panel */}
                <div className="w-1/2 border-r border-khaki/10 flex flex-col bg-bg">
                  <div className="h-10 bg-surface/50 border-b border-khaki/10 flex items-center px-4 justify-between">
                    <span className="font-mono text-xs text-khaki">SYSTEM_CRASH_FIX.JS</span>
                  </div>
                  <div className="flex-1 relative">
                    <Editor
                      theme="vs-dark"
                      language="javascript"
                      value={crashCode}
                      onChange={(val) => {
                        setCrashCode(val || "");
                        handleEditorChange();
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        readOnly: meSubmitted,
                      }}
                    />
                  </div>
                  <div className="p-4 border-t border-khaki/10 bg-surface/20">
                    <button
                      onClick={handleSubmitCrashFix}
                      disabled={meSubmitted || isSubmittingFix}
                      className="w-full bg-cream hover:bg-sand text-bg py-3 rounded-xl font-space font-semibold uppercase text-xs tracking-wider transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingFix ? "Executing Tests..." : meSubmitted ? "Code Submitted" : "Submit Fix"}
                    </button>
                  </div>
                </div>

                {/* Problem Description & Results */}
                <div className="w-1/2 flex flex-col bg-surface/10 overflow-y-auto p-8 space-y-6">
                  <div>
                    <h3 className="font-space text-2xl font-bold tracking-tight text-cream mb-2">{challenge.title}</h3>
                    <p className="text-sm text-khaki leading-relaxed whitespace-pre-wrap">{challenge.description}</p>
                  </div>

                  {/* Test Cases display */}
                  <div className="space-y-4">
                    <h4 className="font-space text-xs font-bold uppercase tracking-wider text-sand">Test Cases Results</h4>
                    {testResults.length === 0 ? (
                      <div className="border border-khaki/10 bg-surface/20 rounded-xl p-6 text-center font-mono text-xs text-khaki">
                        NO EXECUTION RUNS. CLICK &quot;SUBMIT FIX&quot; TO RUN SUITE.
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
                            <div className="flex justify-between items-center text-xs font-bold font-mono">
                              <span>TEST CASE #{tr.testCaseIndex + 1}</span>
                              <span className={tr.passed ? "text-green-400" : "text-red-400"}>
                                {tr.passed ? "PASSED" : "FAILED"} ({tr.timeTakenMs}ms)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-khaki">
                              <div>Input: <span className="text-cream">{tr.input}</span></div>
                              <div>Expected: <span className="text-cream">{tr.expected}</span></div>
                            </div>
                            {tr.error && (
                              <div className="bg-bg border border-red-500/10 rounded p-2 text-red-400 text-xs font-mono">
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

            {/* ARCH WARS MODE */}
            {battle.mode === "ARCH_WARS" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Design Prompt Top */}
                <div className="p-6 border-b border-khaki/10 bg-surface/30">
                  <h3 className="font-space text-lg font-bold tracking-tight text-cream mb-1">Architecture Design Challenge</h3>
                  <p className="text-xs text-khaki leading-relaxed">{challenge.designPrompt}</p>
                </div>

                {!meSubmitted ? (
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left: Text Description */}
                    <div className="w-1/3 border-r border-khaki/10 flex flex-col p-6 space-y-4 bg-bg">
                      <label className="font-space text-xs font-bold uppercase tracking-wider text-sand">System Description</label>
                      <textarea
                        value={archDescription}
                        onChange={(e) => setArchDescription(e.target.value)}
                        placeholder="Detail client-server flow, network boundaries, caching systems, and high concurrency mechanisms..."
                        className="flex-1 bg-surface border border-khaki/20 text-cream p-4 rounded-xl text-sm focus:outline-none focus:border-sand resize-none"
                      />
                      <button
                        onClick={handleSubmitArchitecture}
                        className="bg-cream hover:bg-sand text-bg py-3 rounded-xl font-space font-semibold uppercase text-xs tracking-wider transition cursor-pointer"
                      >
                        Submit Design
                      </button>
                    </div>

                    {/* Right: Flow builder canvas */}
                    <div className="flex-1 flex flex-col bg-surface/5">
                      <div className="h-12 bg-surface border-b border-khaki/10 flex items-center px-6 space-x-2">
                        <span className="font-space text-xs font-bold text-khaki mr-4 uppercase">Nodes Tool:</span>
                        {["Client", "Server", "Database", "Cache", "Queue", "CDN"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => addNode(type)}
                            className="bg-surface2 border border-khaki/25 hover:border-sand text-cream px-3 py-1.5 rounded text-[10px] font-space font-bold uppercase tracking-wide cursor-pointer"
                          >
                            + {type}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1">
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
                ) : (
                  // Both submitted: Show side-by-side design comparison
                  <div className="flex-1 flex overflow-hidden bg-bg">
                    {/* Left: My Architecture */}
                    <div className="w-1/2 border-r border-khaki/10 flex flex-col p-6 overflow-y-auto space-y-4">
                      <h4 className="font-space text-sm font-bold uppercase tracking-wider text-sand">Your Design</h4>
                      <div className="bg-surface/35 border border-khaki/10 rounded-xl p-4 text-sm text-cream leading-relaxed whitespace-pre-wrap">
                        {archDescription}
                      </div>

                      {/* Render own React Flow in read-only mode */}
                      <div className="h-60 bg-surface/20 border border-khaki/10 rounded-xl relative overflow-hidden">
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          edgesFocusable={false}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          fitView
                        >
                          <Background color="#CBBD93" gap={12} size={1} />
                        </ReactFlow>
                      </div>

                      {archAIScore !== null && (
                        <div className="border border-sand/30 bg-olive/5 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center font-space text-sm font-bold text-sand">
                            <span>AI Architecture Score:</span>
                            <span className="text-xl">{archAIScore} / 100</span>
                          </div>
                          <p className="text-xs text-khaki leading-relaxed">{archAIFeedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Opponent Architecture & Voting Panel */}
                    <div className="w-1/2 flex flex-col p-6 overflow-y-auto space-y-6">
                      <h4 className="font-space text-sm font-bold uppercase tracking-wider text-sand">Opponent&apos;s Design</h4>
                      <div className="bg-surface/35 border border-khaki/10 rounded-xl p-4 text-sm text-cream leading-relaxed whitespace-pre-wrap">
                        {archOpponentDescription || "Waiting for opponent&apos;s final design document..."}
                      </div>

                      {/* Render opponent's React Flow in read-only mode */}
                      <div className="h-60 bg-surface/20 border border-khaki/10 rounded-xl relative overflow-hidden">
                        <ReactFlow
                          nodes={archOpponentNodes}
                          edges={archOpponentEdges}
                          edgesFocusable={false}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          elementsSelectable={false}
                          fitView
                        >
                          <Background color="#CBBD93" gap={12} size={1} />
                        </ReactFlow>
                      </div>

                      {/* Voting interface */}
                      <div className="border border-khaki/20 bg-surface p-6 rounded-xl space-y-4">
                        <div className="flex justify-between items-center">
                          <h5 className="font-space text-xs font-bold uppercase tracking-wider text-sand">Upvote the Better System Design</h5>
                          <span className="font-mono text-xs text-cream bg-surface2 px-2.5 py-1 rounded border border-khaki/15">
                            Votes Received: {archPeerVotes}
                          </span>
                        </div>
                        <p className="text-xs text-khaki font-mono leading-relaxed"># Peer votes significantly scale the final system battle rating.</p>
                        
                        <div className="flex space-x-4">
                          <button
                            onClick={() => handleVoteDesign(true)}
                            disabled={archVoteSubmitted}
                            className="flex-1 bg-surface2 border border-khaki/20 hover:border-sand text-cream py-3 rounded-lg font-space font-semibold text-xs uppercase transition disabled:opacity-50"
                          >
                            Upvote Your Design
                          </button>
                          <button
                            onClick={() => handleVoteDesign(false)}
                            disabled={archVoteSubmitted}
                            className="flex-1 bg-cream text-bg py-3 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition disabled:opacity-50"
                          >
                            Upvote Opponent Design
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LOAD BREAKER MODE */}
            {battle.mode === "LOAD_BREAKER" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Slow code reference */}
                <div className="w-1/3 border-r border-khaki/10 flex flex-col p-6 bg-surface/5 space-y-6 overflow-y-auto">
                  <div>
                    <h3 className="font-space text-xl font-bold text-cream mb-2">Optimize slow execution</h3>
                    <p className="text-xs text-khaki leading-relaxed">{challenge.description}</p>
                  </div>

                  <div className="bg-surface border border-khaki/15 rounded-xl p-4 font-mono text-xs space-y-2">
                    <span className="text-[10px] text-khaki uppercase tracking-wider">Benchmark Parameters</span>
                    <div className="flex justify-between border-b border-khaki/10 py-1">
                      <span>Complexity:</span>
                      <span className="text-sand">O(n²)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Execution Time:</span>
                      <span className="text-sand">{optOriginalMs}ms (on 10k items)</span>
                    </div>
                  </div>

                  {/* Read-only Slow Code */}
                  <div className="flex-1 flex flex-col">
                    <span className="font-mono text-[10px] text-khaki mb-2 uppercase">SLOW_IMPLEMENTATION.JS</span>
                    <div className="flex-1 relative min-h-[200px] border border-khaki/15 rounded-xl overflow-hidden">
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

                {/* Monaco Editor and submission comparison */}
                <div className="flex-1 flex flex-col bg-bg">
                  <div className="h-10 bg-surface/50 border-b border-khaki/10 flex items-center px-4 justify-between">
                    <span className="font-mono text-xs text-khaki">OPTIMIZED_IMPLEMENTATION.JS</span>
                    
                    {/* Live score comparison */}
                    <div className="flex items-center space-x-4 font-mono text-xs">
                      <div>YOU: <span className="text-sand">{optMyScore ?? 0}</span></div>
                      <div>OPPONENT: <span className="text-sand">{optOpponentScore ?? 0}</span></div>
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <Editor
                      theme="vs-dark"
                      language="javascript"
                      value={optCode}
                      onChange={(val) => {
                        setOptCode(val || "");
                        handleEditorChange();
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        readOnly: meSubmitted,
                      }}
                    />
                  </div>

                  <div className="p-6 border-t border-khaki/10 bg-surface/30 flex justify-between items-center">
                    <div className="font-mono text-xs text-khaki">
                      {optNewMs !== null && `Latest run speed: ${optNewMs}ms`}
                    </div>
                    <button
                      onClick={handleSubmitOptimization}
                      disabled={meSubmitted || isSubmittingFix}
                      className="bg-cream hover:bg-sand text-bg px-8 py-3 rounded-xl font-space font-semibold uppercase text-xs tracking-wider transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingFix ? "Optimizing..." : meSubmitted ? "Optimization Submitted" : "Submit Optimization"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* BATTLE RESULTS OVERLAY DIALOG */}
      <Dialog.Root open={showResultModal} onOpenChange={setShowResultModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-md z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/25 p-8 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-50 flex-shrink-0" />
            
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 pb-4 text-center">
                {/* Victory / Defeat Icons & Title */}
                {me && battleWinnerId === me.id ? (
                  <div className="space-y-4">
                    <motion.div
                      initial={{ scale: 0.8, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-20 h-20 rounded-full bg-olive/20 border-2 border-sand flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(203,189,147,0.3)] text-sand"
                    >
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.75m-1.875-1.5h1.5a2.25 2.25 0 0 0 2.25-2.25V6.75m3-3h-9v1.5a2.25 2.25 0 0 0 2.25 2.25v5.25a2.25 2.25 0 0 0 2.25 2.25" />
                      </svg>
                    </motion.div>
                    <Dialog.Title className="font-space text-3xl font-extrabold tracking-wider text-cream uppercase">VICTORY</Dialog.Title>
                    <p className="text-xs text-khaki font-mono"># You outperformed the challenger in system execution.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <motion.div
                      initial={{ scale: 0.8, rotate: 20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-20 h-20 rounded-full bg-red-950/20 border-2 border-red-500/30 flex items-center justify-center mx-auto text-red-400"
                    >
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </motion.div>
                    <Dialog.Title className="font-space text-3xl font-extrabold tracking-wider text-cream uppercase">DEFEAT</Dialog.Title>
                    <p className="text-xs text-khaki font-mono"># The opponent engineered a more performant model.</p>
                  </div>
                )}

                {/* ELO Changes with animation */}
                <div className="my-8 bg-bg border border-khaki/10 rounded-xl p-4 flex justify-around items-center">
                  <div>
                    <span className="block text-[10px] text-khaki font-mono uppercase">Rating Change</span>
                    <span className={`text-2xl font-bold font-mono ${me && battleWinnerId === me.id ? "text-green-400" : "text-red-400"}`}>
                      {me && battleWinnerId === me.id ? `+${eloWinnerChange}` : `-${eloLoserChange}`} ELO
                    </span>
                  </div>
                  <div className="w-[1px] h-10 bg-khaki/15" />
                  <div>
                    <span className="block text-[10px] text-khaki font-mono uppercase">Streak</span>
                    <span className="text-2xl font-bold font-mono text-cream">
                      {me && battleWinnerId === me.id ? "streak active" : "reset"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions - Fixed Footer */}
              <div className="flex flex-col space-y-3 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                <button
                  onClick={handleRematchRequest}
                  disabled={rematchRequested}
                  className="w-full bg-cream hover:bg-sand text-bg py-3.5 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-60"
                >
                  {rematchRequested
                    ? opponentRematchRequested
                      ? "Rematch starting..."
                      : "Waiting for opponent..."
                    : opponentRematchRequested
                      ? "Accept Rematch"
                      : "Request Rematch"}
                </button>
                <button
                  onClick={() => router.push("/lobby")}
                  className="w-full border border-khaki/20 hover:border-khaki/50 text-cream py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Back to Lobby
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </div>
    </SocketConnectionBoundary>
  );
}
