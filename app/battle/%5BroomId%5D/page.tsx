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
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import SocketConnectionBoundary from "@/components/SocketConnectionBoundary";
import { useToast } from "@/components/providers/ToastProvider";
import { nodeTypes, NODE_CONFIGS } from "@/components/CustomNodes";

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

function BattleRoomPageContent() {
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

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [selectedTool, setSelectedTool] = useState<string>("select");
  const [history, setHistory] = useState<{ nodes: any[]; edges: any[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeLabelText, setEdgeLabelText] = useState<string>("");
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);

  const { project } = useReactFlow();

  // History management helper
  const recordHistoryState = useCallback((currentNodes: any[], currentEdges: any[]) => {
    const stripCallbacks = (array: any[]) =>
      array.map((item) => {
        const copy = { ...item };
        if (copy.data) {
          copy.data = { ...copy.data };
          delete copy.data.onRename;
          delete copy.data.onDelete;
        }
        return copy;
      });

    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      const cleanCurrent = {
        nodes: stripCallbacks(currentNodes),
        edges: currentEdges,
      };

      if (sliced.length > 0) {
        const last = sliced[sliced.length - 1];
        if (JSON.stringify(last.nodes) === JSON.stringify(cleanCurrent.nodes) &&
            JSON.stringify(last.edges) === JSON.stringify(cleanCurrent.edges)) {
          return prev;
        }
      }
      const newHistory = [...sliced, cleanCurrent];
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  // Rename node callback
  const handleRenameNode = useCallback((nodeId: string, newName: string) => {
    setNodes((nds) => {
      const next = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, name: newName } } : n));
      setTimeout(() => recordHistoryState(next, edges), 0);
      return next;
    });
  }, [edges, recordHistoryState, setNodes]);

  // Delete node callback
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const next = nds.filter((n) => n.id !== nodeId);
      setEdges((eds) => {
        const nextEds = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        setTimeout(() => recordHistoryState(next, nextEds), 0);
        return nextEds;
      });
      return next;
    });
  }, [recordHistoryState, setNodes, setEdges]);

  // Color change callback
  const handleColorChange = useCallback((nodeId: string, color: string) => {
    setNodes((nds) => {
      const next = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, color } } : n));
      setTimeout(() => recordHistoryState(next, edges), 0);
      return next;
    });
  }, [edges, recordHistoryState, setNodes]);

  // Enrich nodes with function callbacks (useful when loading state or undoing)
  const enrichNodes = useCallback((nds: any[]) => {
    return nds.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onRename: handleRenameNode,
        onDelete: handleDeleteNode,
      },
    }));
  }, [handleRenameNode, handleDeleteNode]);

  // Undo / Redo operations
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const state = history[prevIndex];
      setHistoryIndex(prevIndex);
      setNodes(enrichNodes(state.nodes));
      setEdges(state.edges);
    }
  }, [historyIndex, history, enrichNodes, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const state = history[nextIndex];
      setHistoryIndex(nextIndex);
      setNodes(enrichNodes(state.nodes));
      setEdges(state.edges);
    }
  }, [historyIndex, history, enrichNodes, setNodes, setEdges]);

  // Keydown handler for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isUndo = isMac ? (e.metaKey && e.key === "z" && !e.shiftKey) : (e.ctrlKey && e.key === "z" && !e.shiftKey);
      const isRedo = isMac
        ? (e.metaKey && e.key === "z" && e.shiftKey) || (e.metaKey && e.key === "y")
        : (e.ctrlKey && e.key === "z" && e.shiftKey) || (e.ctrlKey && e.key === "y");

      if (isUndo) {
        e.preventDefault();
        handleUndo();
      } else if (isRedo) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Right-click context handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      id: node.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handleContextRename = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const currentName = node.data.name || node.data.label || "";
    const newName = prompt("Rename Node:", currentName);
    if (newName !== null) {
      handleRenameNode(nodeId, newName);
    }
    setContextMenu(null);
  }, [nodes, handleRenameNode]);

  const handleContextDuplicate = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newId = (nodes.length + 1).toString() + "-" + Math.random().toString(36).substr(2, 4);
    const duplicatedNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 35, y: node.position.y + 35 },
      data: {
        ...node.data,
        onRename: handleRenameNode,
        onDelete: handleDeleteNode,
      },
    };
    const next = nodes.concat(duplicatedNode);
    setNodes(next);
    recordHistoryState(next, edges);
    setContextMenu(null);
  }, [nodes, edges, handleRenameNode, handleDeleteNode, recordHistoryState, setNodes]);

  const handleContextDelete = useCallback((nodeId: string) => {
    handleDeleteNode(nodeId);
    setContextMenu(null);
  }, [handleDeleteNode]);

  const handleContextColor = useCallback((nodeId: string, color: string) => {
    handleColorChange(nodeId, color);
    setContextMenu(null);
  }, [handleColorChange]);

  // Close context menu & edge editor on click
  useEffect(() => {
    const closeAll = () => {
      setContextMenu(null);
    };
    document.addEventListener("click", closeAll);
    return () => document.removeEventListener("click", closeAll);
  }, []);

  // Clear Canvas handler
  const handleClearCanvas = useCallback(() => {
    if (confirm("Are you sure you want to clear the entire canvas? This will delete all nodes and arrows.")) {
      setNodes([]);
      setEdges([]);
      recordHistoryState([], []);
    }
  }, [recordHistoryState, setNodes, setEdges]);

  // Export PNG handler
  const handleExportPNG = useCallback(() => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    import("html-to-image").then(({ toPng }) => {
      toPng(el, {
        backgroundColor: "#0D0D0A",
      })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `architecture-blueprint-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((error) => {
        console.error("Failed to export PNG:", error);
      });
    });
  }, []);

  // Edge editing handlers
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeLabelText(edge.label ? String(edge.label) : "");
  }, []);

  const handleUpdateEdgeStyle = useCallback((edgeId: string, styleType: "solid" | "dashed" | "dotted") => {
    setEdges((eds) => {
      const next = eds.map((e) => {
        if (e.id === edgeId) {
          let updated: Partial<Edge> = {};
          if (styleType === "solid") {
            updated = {
              animated: false,
              style: { stroke: "#CBBD93", strokeWidth: 2, strokeDasharray: undefined },
            };
          } else if (styleType === "dashed") {
            updated = {
              animated: true,
              style: { stroke: "#CBBD93", strokeWidth: 2, strokeDasharray: "5,5" },
            };
          } else if (styleType === "dotted") {
            updated = {
              animated: false,
              style: { stroke: "#CBBD93", strokeWidth: 2, strokeDasharray: "1,5", strokeLinecap: "round" },
            };
          }
          const merged = { ...e, ...updated };
          setSelectedEdge(merged);
          return merged;
        }
        return e;
      });
      setTimeout(() => recordHistoryState(nodes, next), 0);
      return next;
    });
  }, [nodes, recordHistoryState, setEdges]);

  const handleUpdateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges((eds) => {
      const next = eds.map((e) => {
        if (e.id === edgeId) {
          const merged = {
            ...e,
            label,
            labelStyle: { fill: "#FAE8B4", fontWeight: 700, fontFamily: "monospace", fontSize: 10 },
            labelBgStyle: { fill: "#161612", fillOpacity: 0.85, rx: 4, ry: 4 },
          };
          setSelectedEdge(merged);
          return merged;
        }
        return e;
      });
      setTimeout(() => recordHistoryState(nodes, next), 0);
      return next;
    });
  }, [nodes, recordHistoryState, setEdges]);

  // Drag stop pushes state to history
  const onNodeDragStop = useCallback(() => {
    recordHistoryState(nodes, edges);
  }, [nodes, edges, recordHistoryState]);

  // Click canvas pane handler
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setSelectedEdge(null);
    setEdgeLabelText("");

    if (selectedTool === "select" || selectedTool === "arrow") {
      return;
    }

    if (!reactFlowWrapper.current) return;
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const nodeId = (nodes.length + 1).toString() + "-" + Math.random().toString(36).substr(2, 4);
    let newNode: Node;

    if (selectedTool === "textLabel") {
      newNode = {
        id: nodeId,
        type: "textLabel",
        data: {
          label: "Text Label",
          name: "Text Label",
          onRename: handleRenameNode,
          onDelete: handleDeleteNode,
        },
        position,
      };
    } else if (selectedTool === "stickyNote") {
      newNode = {
        id: nodeId,
        type: "stickyNote",
        data: {
          label: "Sticky Note",
          name: "Double-click to type notes...",
          onRename: handleRenameNode,
          onDelete: handleDeleteNode,
        },
        position,
      };
    } else {
      newNode = {
        id: nodeId,
        type: "archNode",
        data: {
          label: selectedTool,
          name: selectedTool,
          onRename: handleRenameNode,
          onDelete: handleDeleteNode,
        },
        position,
      };
    }

    const next = nodes.concat(newNode);
    setNodes(next);
    recordHistoryState(next, edges);
    setSelectedTool("select");
  }, [selectedTool, nodes, edges, project, handleRenameNode, handleDeleteNode, recordHistoryState, setNodes]);
  
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
    (params: Connection | Edge) => {
      const newEdge = {
        ...params,
        id: `e-${params.source}-${params.target}-${Math.random().toString(36).substr(2, 4)}`,
        animated: true,
        style: { stroke: "#CBBD93", strokeWidth: 2, strokeDasharray: "5,5" },
      };
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        setTimeout(() => recordHistoryState(nodes, next), 0);
        return next;
      });
    },
    [nodes, recordHistoryState, setEdges]
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
                    <div className="flex-1 flex flex-col bg-surface/5 relative overflow-hidden">
                      {/* HORIZONTAL TOOLBAR */}
                      <div className="h-14 bg-surface border-b border-khaki/10 flex items-center justify-between px-6 flex-shrink-0 relative z-10 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-sand animate-pulse" />
                          <span className="font-space text-xs font-bold uppercase tracking-wider text-cream">Arch Wars Sandbox</span>
                        </div>

                        <div className="flex items-center space-x-3">
                          {/* Undo */}
                          <button
                            type="button"
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-2 hover:bg-surface2/50 rounded border border-khaki/15 hover:border-sand text-khaki hover:text-cream disabled:opacity-30 disabled:hover:border-khaki/15 disabled:hover:text-khaki transition cursor-pointer"
                            title="Undo (Cmd+Z)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                          </button>

                          {/* Redo */}
                          <button
                            type="button"
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 hover:bg-surface2/50 rounded border border-khaki/15 hover:border-sand text-khaki hover:text-cream disabled:opacity-30 disabled:hover:border-khaki/15 disabled:hover:text-khaki transition cursor-pointer"
                            title="Redo (Cmd+Shift+Z)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.934 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.334-4z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
                            </svg>
                          </button>

                          <div className="h-6 w-[1px] bg-khaki/20" />

                          {/* Snap to grid toggle */}
                          <button
                            type="button"
                            onClick={() => setSnapToGrid(!snapToGrid)}
                            className={`px-3 py-1.5 rounded border text-[9px] font-space font-bold uppercase transition ${
                              snapToGrid
                                ? "bg-sand text-bg border-sand"
                                : "border-khaki/15 text-khaki hover:border-sand hover:text-cream"
                            }`}
                          >
                            Snap Grid
                          </button>

                          {/* Clear Canvas */}
                          <button
                            type="button"
                            onClick={handleClearCanvas}
                            className="px-3 py-1.5 border border-red-900/40 hover:border-red-500 text-red-400 hover:bg-red-950/20 rounded text-[9px] font-space font-bold uppercase transition"
                          >
                            Clear Canvas
                          </button>

                          {/* Export PNG */}
                          <button
                            type="button"
                            onClick={handleExportPNG}
                            className="px-3 py-1.5 border border-khaki/15 hover:border-sand text-cream hover:bg-surface2 rounded text-[9px] font-space font-bold uppercase transition"
                          >
                            Export PNG
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 flex relative min-h-0">
                        {/* LEFT TOOL PALETTE */}
                        <div className="absolute left-4 top-4 bottom-4 z-20 w-48 bg-surface/95 border border-khaki/20 rounded-xl p-4 flex flex-col space-y-4 overflow-y-auto backdrop-blur-md shadow-2xl">
                          <div className="space-y-2">
                            <span className="font-mono text-[9px] text-khaki uppercase tracking-widest font-bold">Tools</span>
                            <div className="grid grid-cols-2 gap-2">
                              {/* Select */}
                              <button
                                type="button"
                                onClick={() => setSelectedTool("select")}
                                className={`p-2 rounded-lg border text-xs font-space font-bold uppercase transition flex flex-col items-center justify-center space-y-1 ${
                                  selectedTool === "select"
                                    ? "bg-sand text-bg border-sand"
                                    : "bg-surface2 border-khaki/10 text-cream hover:border-sand"
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z" />
                                </svg>
                                <span className="text-[8px]">Select</span>
                              </button>

                              {/* Draw Arrow */}
                              <button
                                type="button"
                                onClick={() => setSelectedTool("arrow")}
                                className={`p-2 rounded-lg border text-xs font-space font-bold uppercase transition flex flex-col items-center justify-center space-y-1 ${
                                  selectedTool === "arrow"
                                    ? "bg-sand text-bg border-sand"
                                    : "bg-surface2 border-khaki/10 text-cream hover:border-sand"
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                <span className="text-[8px]">Arrow</span>
                              </button>

                              {/* Add Text */}
                              <button
                                type="button"
                                onClick={() => setSelectedTool("textLabel")}
                                className={`p-2 rounded-lg border text-xs font-space font-bold uppercase transition flex flex-col items-center justify-center space-y-1 ${
                                  selectedTool === "textLabel"
                                    ? "bg-sand text-bg border-sand"
                                    : "bg-surface2 border-khaki/10 text-cream hover:border-sand"
                                }`}
                              >
                                <span className="text-sm font-black font-space">T</span>
                                <span className="text-[8px]">Label</span>
                              </button>

                              {/* Add Sticky */}
                              <button
                                type="button"
                                onClick={() => setSelectedTool("stickyNote")}
                                className={`p-2 rounded-lg border text-xs font-space font-bold uppercase transition flex flex-col items-center justify-center space-y-1 ${
                                  selectedTool === "stickyNote"
                                    ? "bg-sand text-bg border-sand"
                                    : "bg-surface2 border-khaki/10 text-cream hover:border-sand"
                                }`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-[8px]">Sticky</span>
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-khaki/10" />

                          <div className="flex-1 flex flex-col space-y-2">
                            <span className="font-mono text-[9px] text-khaki uppercase tracking-widest font-bold">Node Templates</span>
                            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                              {Object.entries(NODE_CONFIGS).map(([type, config]) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setSelectedTool(type)}
                                  className={`w-full px-3 py-2 rounded-lg border text-left text-[9px] font-space font-bold uppercase transition flex items-center justify-between ${
                                    selectedTool === type
                                      ? "bg-sand text-bg border-sand"
                                      : "bg-surface2 border-khaki/10 text-cream hover:border-sand"
                                  }`}
                                >
                                  <span>{type}</span>
                                  <span
                                    className="w-2 h-2 rounded-full border border-white/10"
                                    style={{ backgroundColor: config.color }}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Flow Canvas Area */}
                        <div ref={reactFlowWrapper} className="flex-1 h-full w-full relative min-h-0 pl-52">
                          <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            nodeTypes={nodeTypes}
                            snapToGrid={snapToGrid}
                            snapGrid={[10, 10]}
                            onPaneClick={onPaneClick}
                            onNodeContextMenu={onNodeContextMenu}
                            onEdgeClick={onEdgeClick}
                            onNodeDragStop={onNodeDragStop}
                            fitView
                          >
                            <Background color="#CBBD93" gap={16} size={1} />
                            <Controls className="bg-surface border border-khaki/30 text-cream rounded" />
                          </ReactFlow>

                          {/* EDGE STYLE EDITOR */}
                          {selectedEdge && (
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-[#1A1A14]/95 border border-khaki/30 p-4 rounded-xl shadow-2xl z-20 flex items-center space-x-6 font-sans backdrop-blur-md">
                              <div className="flex flex-col">
                                <span className="font-mono text-[9px] text-khaki uppercase tracking-widest mb-1.5 font-bold">Edge Style</span>
                                <div className="flex bg-bg/50 border border-khaki/10 rounded-lg p-0.5 space-x-1">
                                  {["solid", "dashed", "dotted"].map((style) => (
                                    <button
                                      key={style}
                                      type="button"
                                      onClick={() => handleUpdateEdgeStyle(selectedEdge.id, style as any)}
                                      className={`px-2.5 py-1 rounded text-[9px] font-space font-bold uppercase transition ${
                                        (style === "solid" && !selectedEdge.animated && !selectedEdge.style?.strokeDasharray) ||
                                        (style === "dashed" && selectedEdge.animated) ||
                                        (style === "dotted" && !selectedEdge.animated && selectedEdge.style?.strokeDasharray === "1,5")
                                          ? "bg-sand text-bg"
                                          : "text-cream hover:bg-surface2"
                                      }`}
                                    >
                                      {style}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="h-8 w-[1px] bg-khaki/20" />

                              <div className="flex flex-col">
                                <span className="font-mono text-[9px] text-khaki uppercase tracking-widest mb-1.5 font-bold">Edge Label</span>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={edgeLabelText}
                                    onChange={(e) => {
                                      setEdgeLabelText(e.target.value);
                                      handleUpdateEdgeLabel(selectedEdge.id, e.target.value);
                                    }}
                                    placeholder="e.g. JSON/HTTPS"
                                    className="bg-bg border border-khaki/20 text-cream px-2 py-1 rounded text-xs font-mono focus:outline-none focus:border-sand w-36"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEdge(null)}
                                    className="text-khaki hover:text-cream text-xs px-2 py-1 cursor-pointer"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* CONTEXT MENU */}
                          {contextMenu && (
                            <div
                              className="fixed bg-[#161612] border border-khaki/25 rounded-lg py-1.5 w-40 shadow-2xl z-50 font-sans"
                              style={{ top: contextMenu.y, left: contextMenu.x }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleContextRename(contextMenu.id)}
                                className="w-full text-left px-3.5 py-1.5 text-xs text-cream hover:bg-surface2 transition font-space font-semibold cursor-pointer"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContextDuplicate(contextMenu.id)}
                                className="w-full text-left px-3.5 py-1.5 text-xs text-cream hover:bg-surface2 transition font-space font-semibold cursor-pointer"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContextDelete(contextMenu.id)}
                                className="w-full text-left px-3.5 py-1.5 text-xs text-red-400 hover:bg-surface2 transition font-space font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                              <div className="border-t border-khaki/10 my-1" />
                              <div className="px-3.5 py-1 text-[8px] font-mono text-khaki uppercase tracking-wider cursor-default select-none">Change Color</div>
                              <div className="flex px-3.5 py-1.5 gap-1.5 flex-wrap">
                                {["#3B82F6", "#10B981", "#059669", "#F59E0B", "#8B5CF6", "#EC4899"].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => handleContextColor(contextMenu.id, color)}
                                    className="w-4 h-4 rounded-full border border-white/10 cursor-pointer transition transform hover:scale-110"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
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
                          nodeTypes={nodeTypes}
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
                          nodeTypes={nodeTypes}
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

export default function BattleRoomPage() {
  return (
    <ReactFlowProvider>
      <BattleRoomPageContent />
    </ReactFlowProvider>
  );
}
