import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    player?: {
      id: string;
      githubId: string;
      username: string;
      avatar: string;
      bio: string | null;
      githubUrl: string | null;
      eloRating: number;
      totalWins: number;
      totalLosses: number;
      currentStreak: number;
      badges: string[];
      createdAt: Date;
      updatedAt: Date;
    };
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
