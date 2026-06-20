import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeCode } from "@/lib/piston";

export async function POST(request: Request) {
  try {
    const { code, challengeId, isOptimization } = await request.json();

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const testCases = (challenge.testCases || []) as Array<{ input: string; expected: string }>;

    if (isOptimization) {
      // Build optimization script for LOAD_BREAKER challenges
      const script = `
${code}

async function run() {
  let success = true;
  let elapsed = 0;
  
  try {
    const start = performance.now();
    if (typeof findDuplicates === "function") {
      const largeInput = Array.from({ length: 8000 }, () => Math.floor(Math.random() * 4000));
      findDuplicates(largeInput);
    } else if (typeof multiplyMatrices === "function") {
      const size = 60;
      const A = Array(size).fill(0).map(() => Array(size).fill(0).map(() => Math.random()));
      const B = Array(size).fill(0).map(() => Array(size).fill(0).map(() => Math.random()));
      multiplyMatrices(A, B);
    } else if (typeof fibonacci === "function") {
      fibonacci(30);
    } else if (typeof buildRepeatedString === "function") {
      buildRepeatedString("code", 50000);
    } else if (typeof searchSorted === "function") {
      const arr = Array.from({ length: 30000 }, (_, i) => i * 2);
      searchSorted(arr, 29998);
    } else {
      success = false;
    }
    const end = performance.now();
    elapsed = end - start;
  } catch (err) {
    success = false;
  }
  
  console.log("===OPT_START===");
  console.log(JSON.stringify({ success, elapsed }));
  console.log("===OPT_END===");
}

run();
`;

      const pistonResult = await executeCode(script);
      if (pistonResult.stderr && pistonResult.code !== 0) {
        return NextResponse.json({
          success: false,
          originalMs: challenge.benchmarkMs || 120,
          newMs: 0,
          score: 0,
          error: pistonResult.stderr,
        });
      }

      const stdout = pistonResult.stdout;
      const startIdx = stdout.indexOf("===OPT_START===");
      const endIdx = stdout.indexOf("===OPT_END===");

      let success = false;
      let newMs = 0;

      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = stdout.substring(startIdx + "===OPT_START===".length, endIdx).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          success = parsed.success;
          newMs = parsed.elapsed;
        } catch (err) {
          console.error("Failed to parse optimization results JSON:", err);
        }
      }

      const originalMs = challenge.benchmarkMs || 120;
      let score = 0;
      if (success) {
        score = Math.max(0, Math.round(((originalMs - newMs) / originalMs) * 1000));
      }

      return NextResponse.json({
        success,
        originalMs,
        newMs: Math.round(newMs * 100) / 100,
        score,
      });
    }

    // SYSTEM_CRASH test runs using a single Piston call
    const script = `
class ListNode {
  constructor(val) {
    this.val = val;
    this.next = null;
  }
}
function arrayToList(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  const head = new ListNode(arr[0]);
  let current = head;
  for (let i = 1; i < arr.length; i++) {
    current.next = new ListNode(arr[i]);
    current = current.next;
  }
  return head;
}
function listToArray(head) {
  const arr = [];
  let current = head;
  while (current !== null) {
    arr.push(current.val);
    current = current.next;
  }
  return arr;
}

${code}

if (typeof getUserRecord !== "function") {
  globalThis.getUserRecord = function(userId) {
    return Promise.resolve({ id: userId });
  };
}
if (typeof getUserPreferences !== "function") {
  globalThis.getUserPreferences = function(userId) {
    return Promise.resolve({ theme: "dark" });
  };
}

async function run() {
  const testCases = ${JSON.stringify(testCases)};
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const start = performance.now();
    let passed = false;
    let output = "";
    let error = "";
    
    try {
      const input = eval(tc.input);
      let result;
      if (typeof binarySearch === "function") {
        result = binarySearch(input[0], input[1]);
      } else if (typeof reverseList === "function") {
        const listHead = arrayToList(input);
        const reversedHead = reverseList(listHead);
        result = listToArray(reversedHead);
      } else if (typeof bubbleSort === "function") {
        result = bubbleSort(input);
      } else if (typeof calculateDepth === "function") {
        result = calculateDepth(input);
      } else if (typeof fetchUserData === "function") {
        result = await fetchUserData(input);
      } else if (typeof findDuplicates === "function") {
        result = findDuplicates(input);
      } else if (typeof multiplyMatrices === "function") {
        result = multiplyMatrices(input[0], input[1]);
      } else if (typeof fibonacci === "function") {
        result = fibonacci(input);
      } else if (typeof buildRepeatedString === "function") {
        result = buildRepeatedString(input[0], input[1]);
      } else if (typeof searchSorted === "function") {
        result = searchSorted(input[0], input[1]);
      } else {
        result = null;
      }
      
      output = JSON.stringify(result);
      passed = output === tc.expected;
    } catch (err) {
      error = err.message || "Execution error";
    }
    const end = performance.now();
    
    results.push({
      testCaseIndex: i,
      input: tc.input,
      expected: tc.expected,
      output,
      passed,
      timeTakenMs: Math.round((end - start) * 100) / 100,
      error
    });
  }
  
  console.log("===RESULTS_START===");
  console.log(JSON.stringify(results));
  console.log("===RESULTS_END===");
}

run();
`;

    const pistonResult = await executeCode(script);
    if (pistonResult.stderr && pistonResult.code !== 0) {
      return NextResponse.json({
        success: false,
        results: testCases.map((tc, idx) => ({
          testCaseIndex: idx,
          input: tc.input,
          expected: tc.expected,
          output: "",
          passed: false,
          timeTakenMs: 0,
          error: pistonResult.stderr,
        })),
      });
    }

    const stdout = pistonResult.stdout;
    const startIdx = stdout.indexOf("===RESULTS_START===");
    const endIdx = stdout.indexOf("===RESULTS_END===");

    interface TestCaseResult {
      testCaseIndex: number;
      input: string;
      expected: string;
      output: string;
      passed: boolean;
      timeTakenMs: number;
      error?: string;
    }

    let parsedResults: TestCaseResult[] = [];
    let allPassed = false;

    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = stdout.substring(startIdx + "===RESULTS_START===".length, endIdx).trim();
      try {
        parsedResults = JSON.parse(jsonStr);
        allPassed = parsedResults.every((r: TestCaseResult) => r.passed);
      } catch (err) {
        console.error("Failed to parse evaluation results JSON:", err);
      }
    }

    if (parsedResults.length === 0) {
      return NextResponse.json({
        success: false,
        results: testCases.map((tc, idx) => ({
          testCaseIndex: idx,
          input: tc.input,
          expected: tc.expected,
          output: "",
          passed: false,
          timeTakenMs: 0,
          error: "Execution environment did not output results block.",
        })),
      });
    }

    return NextResponse.json({
      success: allPassed,
      results: parsedResults,
    });
  } catch (error) {
    console.error("Error in api/judge:", error);
    return NextResponse.json({ error: "Failed to judge code" }, { status: 500 });
  }
}
