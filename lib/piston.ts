import axios from "axios";

export interface PistonResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function executeCode(code: string): Promise<PistonResult> {
  const pistonUrl = process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston";
  
  try {
    const response = await axios.post(`${pistonUrl}/execute`, {
      language: "javascript",
      version: "*",
      files: [
        {
          content: code,
        },
      ],
    });

    const run = response.data?.run || {};
    
    return {
      stdout: run.stdout || "",
      stderr: run.stderr || "",
      code: typeof run.code === "number" ? run.code : 0,
    };
  } catch (error) {
    console.error("Piston API execution error:", error);
    throw new Error("Failed to execute code via Piston API");
  }
}
