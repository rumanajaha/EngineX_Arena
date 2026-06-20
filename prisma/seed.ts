import "dotenv/config";
import { PrismaClient, BattleMode, Difficulty } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding challenges into EngineX Arena database...");

  // Clear existing challenges to prevent duplicates during multiple seeds
  await prisma.challenge.deleteMany();

  const challenges = [
    // === SYSTEM CRASH CHALLENGES ===
    {
      mode: BattleMode.SYSTEM_CRASH,
      title: "Broken Binary Search",
      description: "Fix the bug in the binary search function. It causes an infinite loop when the target element is not present in the array.",
      difficulty: Difficulty.EASY,
      brokenCode: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    let mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid; // Bug: should be left = mid + 1
    } else {
      right = mid; // Bug: should be right = mid - 1
    }
  }
  return -1;
}`,
      testCases: [
        { input: "[[1, 3, 5, 7], 5]", expected: "2" },
        { input: "[[1, 3, 5, 7], 2]", expected: "-1" }
      ]
    },
    {
      mode: BattleMode.SYSTEM_CRASH,
      title: "Broken Linked List Reversal",
      description: "Fix the pointer assignments in this linked list reversal function to prevent circular references and null reference crashes.",
      difficulty: Difficulty.MEDIUM,
      brokenCode: `function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr !== null) {
    let nextTemp = curr.next;
    curr.next = prev;
    // Bug: missing forward progress pointer assignments
    // should be:
    // prev = curr;
    // curr = nextTemp;
  }
  return prev;
}`,
      testCases: [
        { input: "[1, 2, 3]", expected: "[3, 2, 1]" }
      ]
    },
    {
      mode: BattleMode.SYSTEM_CRASH,
      title: "Off-by-One in Bubble Sort",
      description: "Correct the array boundary index check in this implementation of bubble sort to prevent accessing undefined elements.",
      difficulty: Difficulty.EASY,
      brokenCode: `function bubbleSort(arr) {
  let n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { // Bug: should be j < n - i - 1
      if (arr[j] > arr[j + 1]) { // Accesses out of bounds at arr[j+1]
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}`,
      testCases: [
        { input: "[5, 1, 4, 2]", expected: "[1, 2, 4, 5]" }
      ]
    },
    {
      mode: BattleMode.SYSTEM_CRASH,
      title: "Recursion Stack Overflow",
      description: "Fix the base case in this recursive depth finder to prevent maximum call stack size exceeded errors when array is empty.",
      difficulty: Difficulty.MEDIUM,
      brokenCode: `function calculateDepth(node) {
  // Bug: wrong base case check
  if (node === undefined) { // Should check: if (node === null) or if (!node)
    return 0;
  }
  return 1 + Math.max(calculateDepth(node.left), calculateDepth(node.right));
}`,
      testCases: [
        { input: "{val: 1, left: null, right: null}", expected: "1" }
      ]
    },
    {
      mode: BattleMode.SYSTEM_CRASH,
      title: "Broken Promise Chain in Async Operation",
      description: "Correct the return values in this async chain to ensure data cascades correctly down to the final callback handler.",
      difficulty: Difficulty.HARD,
      brokenCode: `function fetchUserData(userId) {
  return getUserRecord(userId)
    .then(user => {
      // Bug: missing return keyword
      getUserPreferences(user.id); // should be return getUserPreferences(...)
    })
    .then(prefs => {
      return { id: userId, theme: prefs.theme };
    });
}`,
      testCases: [
        { input: "\"usr-99\"", expected: "{\"id\":\"usr-99\",\"theme\":\"dark\"}" }
      ]
    },

    // === ARCH WARS CHALLENGES ===
    {
      mode: BattleMode.ARCH_WARS,
      title: "URL Shortener System Architecture",
      description: "Design a URL shortener backend handling 100M redirects/day. Key requirements: low latency redirection (<10ms), highly available database, analytics tracking, and secure custom key generation.",
      difficulty: Difficulty.MEDIUM,
      designPrompt: "Design a highly available URL shortener system handling 100 million requests per day. Incorporate high-throughput key generation service, write-behind cache routers, global DNS records, CDN asset caches, and primary-replica database configurations."
    },
    {
      mode: BattleMode.ARCH_WARS,
      title: "Real-Time Multi-User Chat",
      description: "Design a real-time messaging pipeline for 1M concurrent active users. Ensure instant message delivery (<50ms), status presence tracking, persistent storage, and support for group chats.",
      difficulty: Difficulty.HARD,
      designPrompt: "Design a system architecture diagram for a real-time chat application handling 1M concurrent users. Incorporate websocket gateway load balancers, pub/sub message brokers (Redis/Kafka), presence session states, horizontal servers, and distributed databases."
    },
    {
      mode: BattleMode.ARCH_WARS,
      title: "Distributed Rate Limiter",
      description: "Design a rate limiting microservice architecture handling 50k requests/sec. Prevent token bucket overflow, sync limits across regions, and minimize API latency overhead.",
      difficulty: Difficulty.MEDIUM,
      designPrompt: "Design a distributed rate limiter that operates globally across 5 regions. Use low latency caching databases (Redis), client middleware interceptors, fallbacks queues, and rate limiting algorithms (token bucket / sliding window)."
    },
    {
      mode: BattleMode.ARCH_WARS,
      title: "Video Streaming CDN Topology",
      description: "Design a video on demand (VOD) pipeline with adaptive bitrate transcoding, edge delivery network nodes, storage tiers, and serverless encoder tasks.",
      difficulty: Difficulty.HARD,
      designPrompt: "Design a highly scalable Video Streaming CDN architecture. Lay out transcoding servers, object storage pools, multi-tier edge CDN nodes, user clients, and origin media servers to handle global video streaming loads."
    },
    {
      mode: BattleMode.ARCH_WARS,
      title: "Social Notifications Engine",
      description: "Design a fan-out notifications infrastructure processing 10k alerts/sec across email, SMS, and in-app web pushes. Prevent duplicate deliveries and handle queue spikes.",
      difficulty: Difficulty.HARD,
      designPrompt: "Design a push notification system engine for a global social network. Configure event producer nodes, message brokers, worker worker-queues, SMS gateways, APNS/FCM push channels, and client feedback loop receivers."
    },

    // === LOAD BREAKER CHALLENGES ===
    {
      mode: BattleMode.LOAD_BREAKER,
      title: "Optimize Duplicate Finder",
      description: "Optimize this duplicate finder algorithm from O(n²) time complexity down to O(n) to handle large arrays containing up to 100k items.",
      difficulty: Difficulty.EASY,
      slowCode: `function findDuplicates(arr) {
  let duplicates = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
        duplicates.push(arr[i]);
      }
    }
  }
  return duplicates;
}`,
      benchmarkMs: 250,
      testCases: [
        { input: "[1, 2, 3, 1, 2]", expected: "[1, 2]" },
        { input: "[10, 20, 30]", expected: "[]" }
      ]
    },
    {
      mode: BattleMode.LOAD_BREAKER,
      title: "Matrix Multiplication Cache Misses",
      description: "Optimize this loop traversal structure to improve CPU cache locality (L1/L2 hits) and speed up execution of 500x500 matrix products.",
      difficulty: Difficulty.HARD,
      slowCode: `function multiplyMatrices(A, B) {
  let n = A.length;
  let C = Array(n).fill(0).map(() => Array(n).fill(0));
  // Inefficient loop order (i, k, j is much faster than i, j, k due to cache friendliness)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}`,
      benchmarkMs: 300,
      testCases: [
        { input: "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]", expected: "[[19, 22], [43, 50]]" }
      ]
    },
    {
      mode: BattleMode.LOAD_BREAKER,
      title: "Memoize Fibonacci Recursion",
      description: "Optimize the recursive fibonacci sequence calculation from O(2^n) time complexity down to O(n) using dynamic programming / memoization.",
      difficulty: Difficulty.MEDIUM,
      slowCode: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2); // Exponentials recursion
}`,
      benchmarkMs: 50,
      testCases: [
        { input: "10", expected: "55" },
        { input: "30", expected: "832040" }
      ]
    },
    {
      mode: BattleMode.LOAD_BREAKER,
      title: "Inefficient String Concat in Loop",
      description: "Refactor this string builder algorithm. Concat operations inside long loops create fresh allocations and cause garbage collection stalls.",
      difficulty: Difficulty.EASY,
      slowCode: `function buildRepeatedString(word, count) {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += word; // Slow string allocation copy
  }
  return result;
}`,
      benchmarkMs: 150,
      testCases: [
        { input: "[\"code\", 5]", expected: "\"codecodecodecodecode\"" }
      ]
    },
    {
      mode: BattleMode.LOAD_BREAKER,
      title: "Binary Search vs Linear Search",
      description: "This function searches for elements in an already sorted list. Replace the inefficient linear traversal with binary lookup to hit log(n) speeds.",
      difficulty: Difficulty.EASY,
      slowCode: `function searchSorted(arr, target) {
  // Currently linear scan O(n)
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}`,
      benchmarkMs: 100,
      testCases: [
        { input: "[[2, 4, 6, 8, 10], 8]", expected: "3" },
        { input: "[[2, 4, 6, 8, 10], 5]", expected: "-1" }
      ]
    }
  ];

  for (const c of challenges) {
    await prisma.challenge.create({
      data: {
        mode: c.mode,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        brokenCode: c.brokenCode || null,
        slowCode: c.slowCode || null,
        designPrompt: c.designPrompt || null,
        testCases: c.testCases || [],
      }
    });
  }

  console.log(`Success! Seeded ${challenges.length} challenges into the database.`);
}

main()
  .catch((e) => {
    console.error("Error executing seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
