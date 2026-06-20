import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { BattleMode, BattleStatus } from "../app/generated/prisma/client";
import { randomUUID } from "crypto";

const PORT = process.env.SOCKET_PORT ? parseInt(process.env.SOCKET_PORT) : 3001;

const httpServer = createServer((req, res) => {
  if (req.url === "/api/online-count") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ count: getOnlineCount() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket.io Server Running\n");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const queues = new Map<string, Array<{ playerId: string; socketId: string }>>();
const onlinePlayers = new Map<string, string>();

const getOnlineCount = () => {
  const uniquePlayers = new Set(onlinePlayers.values());
  return uniquePlayers.size;
};

io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join:lobby", (playerId: string) => {
    if (!playerId) return;
    socket.join("lobby");
    onlinePlayers.set(socket.id, playerId);
    console.log(`Player ${playerId} joined lobby. Online: ${getOnlineCount()}`);
    io.to("lobby").emit("lobby:players_update", {
      count: getOnlineCount(),
      onlinePlayerIds: Array.from(new Set(onlinePlayers.values())),
    });

    // Auto-join group rooms for this player
    groups.forEach((g, gId) => {
      if (g.memberIds.includes(playerId)) {
        socket.join(`group:${gId}`);
        socket.emit("group:joined", g);
      }
    });
  });

  socket.on("create:room", async (data: { playerId: string; mode: string; difficulty: string; isPrivate: boolean }, callback?: Function) => {
    const { playerId, mode, difficulty } = data;
    try {
      const roomId = randomUUID();
      const inviteCode = roomId.substring(0, 6).toUpperCase();

      await prisma.battle.create({
        data: {
          roomId,
          mode: mode as BattleMode,
          status: BattleStatus.WAITING,
          player1Id: playerId,
        },
      });

      socket.join(roomId);
      console.log(`Room created: ${roomId} by player ${playerId} with difficulty ${difficulty}`);

      const response = { roomId, inviteCode };
      if (callback) {
        callback(response);
      }
      socket.emit("room:created", response);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  });

  socket.on("join:room", async (data: { playerId: string; roomId: string }, callback?: Function) => {
    const { playerId, roomId } = data;
    try {
      const battle = await prisma.battle.findUnique({
        where: { roomId },
      });

      if (!battle) {
        if (callback) callback({ error: "Room not found" });
        return;
      }

      socket.join(roomId);

      if (battle.player1Id !== playerId && !battle.player2Id) {
        const updatedBattle = await prisma.battle.update({
          where: { roomId },
          data: {
            player2Id: playerId,
            status: BattleStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });

        console.log(`Player ${playerId} joined room ${roomId} as Player 2`);
        io.to(roomId).emit("room:ready", {
          battleId: updatedBattle.id,
          roomId,
          redirectUrl: `/battle/${roomId}`,
        });
      } else if (battle.player1Id === playerId || battle.player2Id === playerId) {
        console.log(`Player ${playerId} rejoined room ${roomId}`);
        if (battle.player2Id) {
          socket.emit("room:ready", {
            battleId: battle.id,
            roomId,
            redirectUrl: `/battle/${roomId}`,
          });
        }
      }

      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error joining room:", error);
      if (callback) callback({ error: "Server error" });
    }
  });

  socket.on("join:queue", async (data: { playerId: string; mode: string }) => {
    const { playerId, mode } = data;
    if (!playerId || !mode) return;

    console.log(`Player ${playerId} joined queue for ${mode}`);

    let modeQueue = queues.get(mode);
    if (!modeQueue) {
      modeQueue = [];
      queues.set(mode, modeQueue);
    }

    modeQueue = modeQueue.filter(
      (p) => p.playerId !== playerId && io.sockets.sockets.get(p.socketId) !== undefined
    );

    if (modeQueue.length > 0) {
      const opponent = modeQueue.shift()!;
      queues.set(mode, modeQueue);

      console.log(`Match found in mode ${mode} between ${opponent.playerId} and ${playerId}`);

      try {
        const roomId = randomUUID();
        const battle = await prisma.battle.create({
          data: {
            roomId,
            mode: mode as BattleMode,
            status: BattleStatus.IN_PROGRESS,
            player1Id: opponent.playerId,
            player2Id: playerId,
            startedAt: new Date(),
          },
        });

        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
        if (opponentSocket) {
          opponentSocket.join(roomId);
        }
        socket.join(roomId);

        io.to(roomId).emit("room:ready", {
          battleId: battle.id,
          roomId,
          redirectUrl: `/battle/${roomId}`,
        });
      } catch (error) {
        console.error("Error creating match battle:", error);
      }
    } else {
      modeQueue.push({ playerId, socketId: socket.id });
      queues.set(mode, modeQueue);
    }
  });

  socket.on("lobby:chat:message", (data: { playerId: string; username: string; avatar: string; message: string }) => {
    const { playerId, username, avatar, message } = data;
    io.to("lobby").emit("lobby:chat:message", {
      playerId,
      username,
      avatar,
      message,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("join:battle", (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    socket.join(`battle:${roomId}`);
    console.log(`Player ${playerId} joined battle room: battle:${roomId}`);
  });

  socket.on("player:typing", (data: { roomId: string; playerId: string; isTyping: boolean }) => {
    const { roomId, playerId, isTyping } = data;
    socket.to(`battle:${roomId}`).emit("player:typing_update", { playerId, isTyping });
  });

  socket.on("player:submitted", (data: { roomId: string; playerId: string; score?: number }) => {
    const { roomId, playerId, score } = data;
    io.to(`battle:${roomId}`).emit("player:submitted_update", { playerId, score });
  });

  socket.on("load_breaker:score", (data: { roomId: string; playerId: string; score: number }) => {
    const { roomId, playerId, score } = data;
    socket.to(`battle:${roomId}`).emit("load_breaker:score_update", { playerId, score });
  });

  socket.on("battle:result", async (data: { roomId: string; winnerId: string; winnerChange: number; loserChange: number }) => {
    const { roomId, winnerId, winnerChange, loserChange } = data;
    io.to(`battle:${roomId}`).emit("battle:result_update", { winnerId, winnerChange, loserChange });

    try {
      const battle = await prisma.battle.findUnique({
        where: { roomId },
        include: {
          player1: true,
          player2: true,
        },
      });

      if (battle && battle.player1 && battle.player2) {
        const isP1Winner = battle.player1Id === winnerId;
        const winner = isP1Winner ? battle.player1 : battle.player2;
        const loser = isP1Winner ? battle.player2 : battle.player1;

        const modeMap: Record<string, string> = {
          SYSTEM_CRASH: "SystemCrash",
          ARCH_WARS: "ArchWars",
          LOAD_BREAKER: "LoadBreaker",
        };
        const readableMode = modeMap[battle.mode] || battle.mode;

        const message = `@${winner.username} defeated @${loser.username} in ${readableMode} (+${winnerChange} ELO)`;

        io.emit("hub:activity", {
          id: randomUUID(),
          message,
          mode: battle.mode,
          winner: {
            id: winner.id,
            username: winner.username,
            avatar: winner.avatar,
          },
          loser: {
            id: loser.id,
            username: loser.username,
            avatar: loser.avatar,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Error broadcasting hub activity:", err);
    }
  });

  socket.on("challenge:friend", async (data: { challengerId: string; friendId: string; mode: string; roomId: string }) => {
    const { challengerId, friendId, mode, roomId } = data;
    const friendSockets: string[] = [];
    onlinePlayers.forEach((pId, sId) => {
      if (pId === friendId) {
        friendSockets.push(sId);
      }
    });

    try {
      const challenger = await prisma.player.findUnique({
        where: { id: challengerId },
      });

      if (challenger) {
        friendSockets.forEach((sId) => {
          io.to(sId).emit("friend:challenge_received", {
            challenger: {
              id: challenger.id,
              username: challenger.username,
              avatar: challenger.avatar,
              eloRating: challenger.eloRating,
            },
            mode,
            roomId,
          });
        });
      }
    } catch (error) {
      console.error("Error handling friend challenge:", error);
    }
  });

  socket.on("rematch:request", (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    socket.to(`battle:${roomId}`).emit("rematch:request_received", { playerId });
  });

  // Groups stored in memory on the socket server
  // Structure: Map<groupId, { id, name, memberIds }>
  const groups = new Map<string, { id: string; name: string; memberIds: string[] }>();

  // Direct Messaging
  socket.on("dm:send", async (data: { toId: string; message: string }) => {
    const { toId, message } = data;
    const fromId = onlinePlayers.get(socket.id);
    if (!fromId) return;

    try {
      const sender = await prisma.player.findUnique({
        where: { id: fromId },
      });
      if (sender) {
        onlinePlayers.forEach((pId, sId) => {
          if (pId === toId) {
            io.to(sId).emit("dm:receive", {
              fromId,
              username: sender.username,
              avatar: sender.avatar,
              message,
              timestamp: new Date().toISOString(),
            });
          }
        });
      }
    } catch (err) {
      console.error("Error in dm:send socket handler:", err);
    }
  });

  // Group Management & Chat
  socket.on("group:create", (data: { name: string; memberIds: string[] }) => {
    const { name, memberIds } = data;
    const groupId = randomUUID();
    const newGroup = { id: groupId, name, memberIds };
    groups.set(groupId, newGroup);

    // Make all online members join the group room automatically
    memberIds.forEach((mId) => {
      onlinePlayers.forEach((pId, sId) => {
        if (pId === mId) {
          const memberSocket = io.sockets.sockets.get(sId);
          if (memberSocket) {
            memberSocket.join(`group:${groupId}`);
            memberSocket.emit("group:joined", newGroup);
          }
        }
      });
    });
  });

  socket.on("group:join", (data: { groupId: string; playerId: string }) => {
    const { groupId, playerId } = data;
    const group = groups.get(groupId);
    if (group && group.memberIds.includes(playerId)) {
      socket.join(`group:${groupId}`);
      socket.emit("group:joined", group);
    }
  });

  socket.on("group:message", (data: { groupId: string; message: string; fromId: string; username: string }) => {
    const { groupId, message, fromId, username } = data;
    io.to(`group:${groupId}`).emit("group:receive", {
      groupId,
      fromId,
      username,
      message,
      timestamp: new Date().toISOString(),
    });
  });

  // Automatically join group rooms when player joins lobby
  socket.on("join:lobby_groups", (playerId: string) => {
    groups.forEach((g, gId) => {
      if (g.memberIds.includes(playerId)) {
        socket.join(`group:${gId}`);
        socket.emit("group:joined", g);
      }
    });
  });

  socket.on("disconnect", () => {
    const playerId = onlinePlayers.get(socket.id);
    console.log(`Socket disconnected: ${socket.id} (Player: ${playerId})`);
    
    if (playerId) {
      onlinePlayers.delete(socket.id);
      
      queues.forEach((queue, mode) => {
        const updated = queue.filter((p) => p.socketId !== socket.id);
        queues.set(mode, updated);
      });

      io.to("lobby").emit("lobby:players_update", {
        count: getOnlineCount(),
        onlinePlayerIds: Array.from(new Set(onlinePlayers.values())),
      });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io server listening on port ${PORT}`);
});
