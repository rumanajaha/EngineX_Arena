"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import SocketConnectionBoundary from "@/components/SocketConnectionBoundary";
import { useToast } from "@/components/providers/ToastProvider";

interface ChatMessage {
  playerId: string;
  username: string;
  avatar: string;
  message: string;
  timestamp: string;
}

interface Room {
  id: string;
  roomId: string;
  mode: string;
  status: string;
  player1: {
    username: string;
    avatar: string;
    eloRating: number;
  };
}

interface Friend {
  id: string;
  username: string;
  avatar: string;
  eloRating: number;
}

interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export default function LobbyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const player = session?.player;
  const { showToast } = useToast();

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // States
  const [onlineCount, setOnlineCount] = useState(0);
  const [mobileView, setMobileView] = useState<"dashboard" | "chat">("dashboard");
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingMode, setSearchingMode] = useState("");
  
  // Custom Room creation details
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState("SYSTEM_CRASH");
  const [createDifficulty, setCreateDifficulty] = useState("MEDIUM");
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  
  // Host waiting states
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState(false);
  const [waitingRoomId, setWaitingRoomId] = useState("");
  const [waitingInviteCode, setWaitingInviteCode] = useState("");

  // Tabs states
  const [activeTab, setActiveTab] = useState<"global" | "friends" | "groups">("global");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeDmFriend, setActiveDmFriend] = useState<Friend | null>(null);
  const [dms, setDms] = useState<Record<string, ChatMessage[]>>({});
  const [dmInput, setDmInput] = useState("");

  // Groups states
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMessages, setGroupMessages] = useState<Record<string, ChatMessage[]>>({});
  const [groupMessageInput, setGroupMessageInput] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const dmEndRef = useRef<HTMLDivElement | null>(null);
  const groupEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch rooms list from database
  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
    }
  };

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends/list");
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (err) {
      console.error("Error fetching friends list:", err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchFriends();
    const interval = setInterval(() => {
      fetchRooms();
      fetchFriends();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chats
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  useEffect(() => {
    if (dmEndRef.current) {
      dmEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dms, activeDmFriend]);

  useEffect(() => {
    if (groupEndRef.current) {
      groupEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupMessages, activeGroup]);

  // Socket setup
  useEffect(() => {
    if (!player) return;

    // Connect to Socket.io server
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.emit("join:lobby", player.id);

    // Auto-join matchmaking queue if a mode is pre-selected in query params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode) {
        setIsSearching(true);
        setSearchingMode(mode);
        socket.emit("join:queue", {
          playerId: player.id,
          mode,
        });
      }

      const challengeFriendId = params.get("challengeFriendId");
      if (challengeFriendId) {
        socket.emit("create:room", {
          playerId: player.id,
          mode: "SYSTEM_CRASH",
          difficulty: "MEDIUM",
          isPrivate: true,
        }, (res: { roomId: string; inviteCode: string }) => {
          socket.emit("challenge:friend", {
            challengerId: player.id,
            friendId: challengeFriendId,
            mode: "SYSTEM_CRASH",
            roomId: res.roomId,
          });

          setWaitingRoomId(res.roomId);
          setWaitingInviteCode(res.inviteCode);
          setIsWaitingForOpponent(true);
          showToast("Challenge Sent", "Direct match room established and invite transmitted.", "success");
        });

        // Clear query parameters from URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.delete("challengeFriendId");
        url.searchParams.delete("friendName");
        window.history.replaceState({}, "", url.toString());
      }
    }

    socket.on("lobby:players_update", (data: { count: number; onlinePlayerIds?: string[] }) => {
      setOnlineCount(data.count);
      if (data.onlinePlayerIds) {
        setOnlinePlayerIds(data.onlinePlayerIds);
      }
    });

    socket.on("lobby:chat:message", (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
    });

    // DMs receive
    socket.on("dm:receive", (data: { fromId: string; username: string; avatar: string; message: string; timestamp: string }) => {
      setDms((prev) => {
        const key = data.fromId;
        const currentList = prev[key] || [];
        return {
          ...prev,
          [key]: [
            ...currentList,
            {
              playerId: data.fromId,
              username: data.username,
              avatar: data.avatar,
              message: data.message,
              timestamp: data.timestamp,
            },
          ],
        };
      });
    });

    // Group join & messages receive
    socket.on("group:joined", (group: Group) => {
      setGroupsList((prev) => {
        if (prev.some((g) => g.id === group.id)) return prev;
        return [...prev, group];
      });
    });

    socket.on("group:receive", (data: { groupId: string; fromId: string; username: string; message: string; timestamp: string }) => {
      setGroupMessages((prev) => {
        const key = data.groupId;
        const currentList = prev[key] || [];
        return {
          ...prev,
          [key]: [
            ...currentList,
            {
              playerId: data.fromId,
              username: data.username,
              avatar: "", // Handled on display using generic or no avatar if not stored
              message: data.message,
              timestamp: data.timestamp,
            },
          ],
        };
      });
    });

    socket.on("room:ready", (data: { battleId: string; roomId: string; redirectUrl: string }) => {
      setIsSearching(false);
      setIsWaitingForOpponent(false);
      router.push(`/battle/${data.roomId}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [player, router, showToast]);

  // Actions
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !player || !socketRef.current) return;

    socketRef.current.emit("lobby:chat:message", {
      playerId: player.id,
      username: player.username,
      avatar: player.avatar,
      message: messageInput.trim(),
    });
    setMessageInput("");
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmInput.trim() || !activeDmFriend || !player || !socketRef.current) return;

    const messageText = dmInput.trim();
    socketRef.current.emit("dm:send", {
      toId: activeDmFriend.id,
      message: messageText,
    });

    const newMsg: ChatMessage = {
      playerId: player.id,
      username: player.username,
      avatar: player.avatar,
      message: messageText,
      timestamp: new Date().toISOString(),
    };

    setDms((prev) => {
      const key = activeDmFriend.id;
      const currentList = prev[key] || [];
      return {
        ...prev,
        [key]: [...currentList, newMsg],
      };
    });

    setDmInput("");
  };

  const handleSendGroupMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupMessageInput.trim() || !activeGroup || !player || !socketRef.current) return;

    socketRef.current.emit("group:message", {
      groupId: activeGroup.id,
      message: groupMessageInput.trim(),
      fromId: player.id,
      username: player.username,
    });

    setGroupMessageInput("");
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !player || !socketRef.current) return;

    const memberIds = [...selectedGroupMembers, player.id];
    socketRef.current.emit("group:create", {
      name: newGroupName.trim(),
      memberIds,
    });

    setNewGroupName("");
    setSelectedGroupMembers([]);
    setIsCreateGroupOpen(false);
    showToast("Group Created", "Your new group chat has been established.", "success");
  };

  const handleQuickMatch = (mode: string) => {
    if (!player || !socketRef.current) return;
    setIsSearching(true);
    setSearchingMode(mode);
    socketRef.current.emit("join:queue", {
      playerId: player.id,
      mode,
    });
    showToast("Matchmaking Started", `Searching for opponents in ${formatModeName(mode)} mode.`, "info");
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    showToast("Matchmaking Cancelled", "Removed from the matchmaking queue.", "info");
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
      socketRef.current.emit("join:lobby", player?.id);
    }
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !socketRef.current) return;

    socketRef.current.emit(
      "create:room",
      {
        playerId: player.id,
        mode: createMode,
        difficulty: createDifficulty,
        isPrivate: createIsPrivate,
      },
      (res: { roomId: string; inviteCode: string }) => {
        setWaitingRoomId(res.roomId);
        setWaitingInviteCode(res.inviteCode);
        setIsWaitingForOpponent(true);
        setCreateModalOpen(false);
      }
    );
  };

  const handleJoinRoom = (roomId: string) => {
    if (!player || !socketRef.current) return;
    socketRef.current.emit("join:room", {
      playerId: player.id,
      roomId,
    });
  };

  const toggleGroupMember = (friendId: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const formatModeName = (mode: string) => {
    return mode.replace("_", " ");
  };

  // Filter online friends
  const onlineFriends = friends.filter((f) => onlinePlayerIds.includes(f.id));

  return (
    <SocketConnectionBoundary>
      <div className="h-full w-full flex flex-col font-sans overflow-hidden relative bg-bg text-cream">
        {/* Background glow decoration */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-olive/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-sand/5 blur-[100px] pointer-events-none" />

        {/* Mobile View Toggle Switcher */}
        <div className="flex md:hidden bg-surface/40 border-b border-khaki/10 p-2 space-x-2 flex-shrink-0 relative z-20">
          <button
            onClick={() => setMobileView("dashboard")}
            className={`flex-1 py-2 font-space text-[11px] uppercase font-bold tracking-wider rounded-lg transition ${
              mobileView === "dashboard" ? "bg-cream text-bg" : "text-khaki"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setMobileView("chat")}
            className={`flex-grow py-2 font-space text-[11px] uppercase font-bold tracking-wider rounded-lg transition ${
              mobileView === "chat" ? "bg-cream text-bg" : "text-khaki"
            }`}
          >
            Chat & Socials ({onlineCount})
          </button>
        </div>

        {/* Main Grid */}
        <div className="flex-1 flex overflow-hidden relative z-10 flex-col md:flex-row">
          
          {/* Left Sidebar (Tabs Chat) */}
          <aside className={`${mobileView === "chat" ? "flex" : "hidden"} md:flex w-full md:w-80 border-b md:border-b-0 md:border-r border-khaki/10 bg-surface/30 flex-col h-full overflow-hidden flex-shrink-0`}>
            {/* Header / Online Status */}
            <div className="p-4 border-b border-khaki/10 flex items-center justify-between bg-surface2/30 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-sand animate-ping" />
                <span className="font-space font-bold uppercase text-xs tracking-wider text-sand">Live Lobby</span>
              </div>
              <span className="font-mono text-xs text-cream bg-bg border border-khaki/20 px-2 py-0.5 rounded">
                {onlineCount} Online
              </span>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-khaki/10 bg-surface2/15 flex-shrink-0">
              {["Global", "Friends", "Groups"].map((t) => {
                const type = t.toLowerCase() as "global" | "friends" | "groups";
                const isActive = activeTab === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setActiveTab(type);
                      setActiveDmFriend(null);
                      setActiveGroup(null);
                    }}
                    className={`flex-1 py-3 font-space text-[10px] uppercase font-bold tracking-wider transition ${
                      isActive ? "text-sand border-b-2 border-sand bg-surface/20" : "text-khaki hover:text-cream"
                    } cursor-pointer`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* GLOBAL TAB */}
              {activeTab === "global" && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center text-xs text-khaki italic">
                        Lobby is quiet... Start the conversation!
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="flex space-x-3 text-sm">
                          <img src={msg.avatar} alt={msg.username} className="w-8 h-8 rounded-lg border border-khaki/10 flex-shrink-0 object-cover" />
                          <div className="flex-1">
                            <div className="flex items-baseline space-x-2">
                              <span className="font-space font-semibold text-sand">@{msg.username}</span>
                              <span className="font-mono text-[9px] text-khaki">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-cream/95 mt-0.5 font-sans break-words text-xs leading-normal">{msg.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 border-t border-khaki/10 bg-surface/50 flex-shrink-0">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Broadcast to lobby..."
                        className="flex-1 bg-bg border border-khaki/20 text-cream px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-sand"
                      />
                      <button
                        type="submit"
                        className="bg-cream hover:bg-sand text-bg px-4 py-2 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer flex-shrink-0"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* FRIENDS TAB */}
              {activeTab === "friends" && (
                <>
                  {!activeDmFriend ? (
                    // Friends List
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-khaki pb-2 border-b border-khaki/5 mb-2">
                        Online Friends
                      </div>
                      {onlineFriends.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-center text-xs text-khaki italic">
                          No friends online right now
                        </div>
                      ) : (
                        onlineFriends.map((friend) => (
                          <div
                            key={friend.id}
                            onClick={() => setActiveDmFriend(friend)}
                            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-surface2/30 border border-transparent hover:border-khaki/10 cursor-pointer transition"
                          >
                            <div className="relative flex-shrink-0">
                              <img src={friend.avatar} alt={friend.username} className="w-8 h-8 rounded-lg border border-khaki/15 object-cover" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg bg-sand animate-pulse" />
                            </div>
                            <div className="flex-grow min-w-0">
                              <span className="font-space font-semibold text-cream block text-xs truncate">@{friend.username}</span>
                              <span className="font-mono text-[9px] text-khaki">ELO: {friend.eloRating}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    // DM Chat Panel
                    <div className="flex-grow flex flex-col overflow-hidden">
                      {/* DM Header */}
                      <div className="p-3 border-b border-khaki/10 bg-surface2/20 flex items-center justify-between flex-shrink-0">
                        <button
                          onClick={() => setActiveDmFriend(null)}
                          className="text-[10px] font-space font-bold uppercase tracking-wider text-khaki hover:text-cream flex items-center space-x-1 cursor-pointer"
                        >
                          <span>&larr; Friends</span>
                        </button>
                        <span className="font-space font-bold text-xs text-sand truncate max-w-[120px]">
                          @{activeDmFriend.username}
                        </span>
                      </div>

                      {/* DM Messages Feed */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {(dms[activeDmFriend.id] || []).length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-xs text-khaki italic">
                            Message history is empty. Say hello!
                          </div>
                        ) : (
                          (dms[activeDmFriend.id] || []).map((msg, idx) => (
                            <div key={idx} className="flex space-x-3 text-sm">
                              <img src={msg.avatar} alt={msg.username} className="w-7 h-7 rounded-lg border border-khaki/10 flex-shrink-0 object-cover" />
                              <div className="flex-grow min-w-0">
                                <div className="flex items-baseline space-x-2">
                                  <span className="font-space font-semibold text-sand text-xs">@{msg.username}</span>
                                  <span className="font-mono text-[8px] text-khaki">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-cream/95 mt-0.5 font-sans break-words text-xs leading-normal">{msg.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={dmEndRef} />
                      </div>

                      {/* DM Input Form */}
                      <form onSubmit={handleSendDm} className="p-4 border-t border-khaki/10 bg-surface/50 flex-shrink-0">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={dmInput}
                            onChange={(e) => setDmInput(e.target.value)}
                            placeholder={`Message @${activeDmFriend.username}...`}
                            className="flex-1 bg-bg border border-khaki/20 text-cream px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-sand"
                          />
                          <button
                            type="submit"
                            className="bg-cream hover:bg-sand text-bg px-4 py-2 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer flex-shrink-0"
                          >
                            Send
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}

              {/* GROUPS TAB */}
              {activeTab === "groups" && (
                <>
                  {!activeGroup ? (
                    // Groups List
                    <div className="flex-grow flex flex-col overflow-hidden p-4 space-y-4">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-khaki">My Groups</span>
                        <button
                          onClick={() => {
                            setNewGroupName("");
                            setSelectedGroupMembers([]);
                            setIsCreateGroupOpen(true);
                          }}
                          className="bg-cream hover:bg-sand text-bg text-[9px] font-space font-bold uppercase px-2 py-1 rounded transition cursor-pointer"
                        >
                          Create Group
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2">
                        {groupsList.length === 0 ? (
                          <div className="h-40 flex items-center justify-center text-center text-xs text-khaki italic">
                            You are not in any groups
                          </div>
                        ) : (
                          groupsList.map((g) => (
                            <div
                              key={g.id}
                              onClick={() => setActiveGroup(g)}
                              className="p-3 bg-surface2/25 border border-khaki/10 rounded-xl hover:border-sand/40 cursor-pointer transition flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <span className="font-space font-bold text-cream text-xs block truncate">{g.name}</span>
                                <span className="font-mono text-[9px] text-khaki">{g.memberIds.length} members</span>
                              </div>
                              <span className="text-[10px] text-khaki font-mono">&rarr;</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    // Group Chat Panel
                    <div className="flex-grow flex flex-col overflow-hidden">
                      {/* Group Header */}
                      <div className="p-3 border-b border-khaki/10 bg-surface2/20 flex items-center justify-between flex-shrink-0">
                        <button
                          onClick={() => setActiveGroup(null)}
                          className="text-[10px] font-space font-bold uppercase tracking-wider text-khaki hover:text-cream flex items-center space-x-1 cursor-pointer"
                        >
                          <span>&larr; Groups</span>
                        </button>
                        <span className="font-space font-bold text-xs text-sand truncate max-w-[120px]">
                          {activeGroup.name}
                        </span>
                      </div>

                      {/* Group Chat Feed */}
                      <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {(groupMessages[activeGroup.id] || []).length === 0 ? (
                          <div className="h-full flex items-center justify-center text-center text-xs text-khaki italic">
                            Group chat is active. Send a message to start!
                          </div>
                        ) : (
                          (groupMessages[activeGroup.id] || []).map((msg, idx) => (
                            <div key={idx} className="text-xs space-y-0.5">
                              <div className="flex items-baseline space-x-2">
                                <span className="font-space font-bold text-sand">@{msg.username}</span>
                                <span className="font-mono text-[8px] text-khaki">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-cream/95 font-sans break-words leading-relaxed">{msg.message}</p>
                            </div>
                          ))
                        )}
                        <div ref={groupEndRef} />
                      </div>

                      {/* Group Message Form */}
                      <form onSubmit={handleSendGroupMessage} className="p-4 border-t border-khaki/10 bg-surface/50 flex-shrink-0">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={groupMessageInput}
                            onChange={(e) => setGroupMessageInput(e.target.value)}
                            placeholder="Message group..."
                            className="flex-1 bg-bg border border-khaki/20 text-cream px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-sand"
                          />
                          <button
                            type="submit"
                            className="bg-cream hover:bg-sand text-bg px-4 py-2 rounded-lg font-space font-semibold text-[10px] uppercase tracking-wider transition cursor-pointer flex-shrink-0"
                          >
                            Send
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}

            </div>
          </aside>

          {/* Right Dashboard Area */}
          <main className={`${mobileView === "dashboard" ? "flex" : "hidden"} md:flex flex-1 p-4 md:p-8 overflow-y-auto flex-col space-y-6 md:space-y-8 h-full`}>
            {/* Combats Section */}
            <section className="space-y-4">
              <h2 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Matchmaking</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    mode: "SYSTEM_CRASH",
                    title: "System Crash",
                    desc: "Defend memory limits & debug overflows.",
                    color: "border-sand/30 hover:border-sand bg-gradient-to-br from-surface to-olive/5",
                  },
                  {
                    mode: "ARCH_WARS",
                    title: "Arch Wars",
                    desc: "Design optimal system topologies.",
                    color: "border-khaki/30 hover:border-khaki bg-gradient-to-br from-surface to-khaki/5",
                  },
                  {
                    mode: "LOAD_BREAKER",
                    title: "Load Breaker",
                    desc: "Optimize database queries under heavy load.",
                    color: "border-olive/30 hover:border-olive bg-gradient-to-br from-surface to-olive/10",
                  },
                ].map((item) => (
                  <div
                    key={item.mode}
                    className={`border rounded-xl p-6 flex flex-col justify-between transition-all duration-300 group ${item.color}`}
                  >
                    <div>
                      <h3 className="font-space text-xl font-bold text-cream mb-2">{item.title}</h3>
                      <p className="text-xs text-khaki leading-relaxed">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => handleQuickMatch(item.mode)}
                      className="mt-6 w-full bg-cream text-bg py-2.5 rounded-lg font-space font-semibold text-xs uppercase tracking-wider transition group-hover:bg-sand cursor-pointer"
                    >
                      Quick Match
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Rooms browser section */}
            <section className="space-y-4 flex-1 flex flex-col">
              <div className="flex justify-between items-center">
                <h2 className="font-space text-lg font-bold uppercase tracking-wider text-sand">Public Rooms</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={fetchRooms}
                    className="border border-khaki/20 text-cream px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-surface2 transition cursor-pointer"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-cream text-bg px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition cursor-pointer"
                  >
                    Create Room
                  </button>
                </div>
              </div>

              {rooms.length === 0 ? (
                <div className="flex-1 border border-khaki/10 bg-surface/20 rounded-xl p-10 text-center flex flex-col items-center justify-center text-khaki font-mono text-sm">
                  <svg className="w-12 h-12 text-khaki/30 mb-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  NO OPEN ROOMS AVAILABLE. CREATE A ROOM TO HOST A BATTLE.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-surface border border-khaki/15 rounded-xl p-4 flex items-center justify-between hover:border-khaki/35 transition"
                    >
                      <div className="flex items-center space-x-4">
                        <img src={room.player1.avatar} alt={room.player1.username} className="w-10 h-10 rounded-lg border border-khaki/20" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-space font-semibold text-cream">{room.player1.username}</span>
                            <span className="font-mono text-[10px] text-khaki">(ELO: {room.player1.eloRating})</span>
                          </div>
                          <div className="flex space-x-2 mt-1">
                            <span className="bg-surface2 border border-khaki/15 text-[10px] px-2 py-0.5 rounded-full font-space font-bold uppercase tracking-wider text-sand">
                              {formatModeName(room.mode)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinRoom(room.roomId)}
                        className="bg-cream text-bg px-4 py-2 rounded-lg font-space font-semibold text-xs uppercase hover:bg-sand transition cursor-pointer"
                      >
                        Join Battle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>

        {/* MATCHMAKING QUEUE OVERLAY */}
        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-bg/95 backdrop-blur-md flex flex-col justify-center items-center z-50 font-sans"
            >
              <div className="text-center space-y-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full bg-olive/20 border-2 border-sand flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(203,189,147,0.25)]"
                >
                  <svg className="w-10 h-10 text-sand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707" />
                  </svg>
                </motion.div>
                <div className="space-y-2">
                  <h3 className="font-space text-2xl font-bold tracking-wider text-cream uppercase">Searching for Opponent</h3>
                  <p className="font-mono text-sm text-khaki"># Mode: {formatModeName(searchingMode)}</p>
                </div>
                <button
                  onClick={handleCancelSearch}
                  className="border border-sand/40 hover:border-sand hover:bg-surface/30 px-6 py-2.5 rounded-xl font-space font-semibold text-xs tracking-wider uppercase transition cursor-pointer"
                >
                  Cancel Search
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HOST WAITING OVERLAY */}
        <AnimatePresence>
          {isWaitingForOpponent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-bg/95 backdrop-blur-md flex flex-col justify-center items-center z-50 font-sans"
            >
              <div className="text-center space-y-6 max-w-md px-6">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full bg-olive/20 border-2 border-sand flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(203,189,147,0.25)]"
                >
                  <svg className="w-10 h-10 text-sand animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </motion.div>
                <div className="space-y-2">
                  <h3 className="font-space text-2xl font-bold tracking-wider text-cream uppercase">Waiting for Challenger</h3>
                  <p className="font-mono text-sm text-khaki"># Battle room successfully established.</p>
                </div>

                <div className="bg-surface border border-khaki/20 rounded-xl p-4 text-left font-mono space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-khaki uppercase">Invite Code:</span>
                    <span className="text-cream text-lg font-bold">{waitingInviteCode}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-khaki uppercase">Room ID:</span>
                    <span className="text-sand text-[10px] truncate max-w-[200px]">{waitingRoomId}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsWaitingForOpponent(false)}
                  className="border border-sand/40 hover:border-sand hover:bg-surface/30 px-6 py-2.5 rounded-xl font-space font-semibold text-xs tracking-wider uppercase transition cursor-pointer"
                >
                  Return to Lobby
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CREATE ROOM MODAL */}
        <Dialog.Root open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 p-8 rounded-2xl w-full max-w-md z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[90vh]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-50" />
              
              <Dialog.Title className="font-space text-2xl font-bold text-cream mb-6 flex-shrink-0">CREATE BATTLE ROOM</Dialog.Title>
              
              <form onSubmit={handleCreateRoomSubmit} className="flex-1 flex flex-col min-h-0">
                {/* Scrollable contents */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-6 min-h-0 pb-4">
                  {/* Select Mode */}
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-khaki font-mono">Battle Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["SYSTEM_CRASH", "ARCH_WARS", "LOAD_BREAKER"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCreateMode(m)}
                          className={`py-2 text-[10px] font-space font-bold uppercase rounded-lg border tracking-wider transition ${
                            createMode === m
                              ? "bg-cream text-bg border-cream"
                              : "border-khaki/20 hover:border-khaki/50 text-cream"
                          }`}
                        >
                          {formatModeName(m)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Difficulty */}
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-khaki font-mono">Difficulty</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["EASY", "MEDIUM", "HARD"].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCreateDifficulty(d)}
                          className={`py-2 text-xs font-space font-bold uppercase rounded-lg border tracking-wider transition ${
                            createDifficulty === d
                              ? "bg-cream text-bg border-cream"
                              : "border-khaki/20 hover:border-khaki/50 text-cream"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Public/Private */}
                  <div className="flex items-center justify-between border-t border-b border-khaki/10 py-4 font-mono text-xs">
                    <span className="text-khaki uppercase">Room Privacy</span>
                    <div className="flex items-center space-x-2">
                      <span className={!createIsPrivate ? "text-cream" : "text-khaki"}>PUBLIC</span>
                      <button
                        type="button"
                        onClick={() => setCreateIsPrivate(!createIsPrivate)}
                        className="relative w-10 h-6 bg-surface2 border border-khaki/20 rounded-full transition duration-300"
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-cream rounded-full transition transform ${
                            createIsPrivate ? "translate-x-4" : ""
                          }`}
                        />
                      </button>
                      <span className={createIsPrivate ? "text-cream" : "text-khaki"}>PRIVATE</span>
                    </div>
                  </div>
                </div>

                {/* Actions - Fixed Footer */}
                <div className="flex space-x-4 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-cream text-bg py-3 rounded-xl font-space font-semibold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer"
                  >
                    Host Battle
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* CREATE GROUP MODAL */}
        <Dialog.Root open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
            <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface border border-khaki/20 p-6 rounded-2xl w-full max-w-sm z-50 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sand to-transparent opacity-60 flex-shrink-0" />
              
              <Dialog.Title className="font-space text-lg font-bold text-cream mb-4 uppercase flex-shrink-0">
                Create Group Chat
              </Dialog.Title>

              <form onSubmit={handleCreateGroup} className="flex-grow flex flex-col min-h-0">
                <div className="flex-grow overflow-y-auto pr-1 space-y-4 min-h-0 pb-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-khaki">Group Name</label>
                    <input
                      type="text"
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Enter group name..."
                      className="w-full bg-bg border border-khaki/20 text-cream p-2.5 rounded-lg text-xs focus:outline-none focus:border-sand"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-mono tracking-wider text-khaki">Select Friends</label>
                    <div className="max-h-40 overflow-y-auto divide-y divide-khaki/5 bg-bg/50 border border-khaki/10 rounded-lg p-2">
                      {friends.length === 0 ? (
                        <div className="text-center py-4 text-xs text-khaki italic">
                          No friends to invite
                        </div>
                      ) : (
                        friends.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => toggleGroupMember(f.id)}
                            className="flex items-center justify-between p-2 cursor-pointer hover:bg-surface2/20 rounded transition text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <img src={f.avatar} alt={f.username} className="w-6 h-6 rounded border border-khaki/15 object-cover" />
                              <span className="font-space font-semibold text-cream">@{f.username}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedGroupMembers.includes(f.id)}
                              onChange={() => {}}
                              className="accent-sand"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-khaki/10 mt-auto bg-surface flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupOpen(false)}
                    className="w-1/2 border border-khaki/20 hover:border-khaki/50 py-2.5 rounded-xl font-space font-semibold text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                    className="w-1/2 bg-cream text-bg py-2.5 rounded-xl font-space font-semibold text-xs uppercase tracking-wider hover:bg-sand transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

      </div>
    </SocketConnectionBoundary>
  );
}
