// import { AuthOptions } from "next-auth";
// import GithubProvider from "next-auth/providers/github";
// import { PrismaAdapter } from "@auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";

// interface GithubProfile {
//   id: number;
//   login: string;
//   avatar_url: string;
//   html_url: string;
// }

// export const authOptions: AuthOptions = {
//   adapter: PrismaAdapter(prisma),
//   providers: [
//     GithubProvider({
//       clientId: process.env.GITHUB_CLIENT_ID || "",
//       clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
//       profile(profile) {
//         return {
//           id: profile.id.toString(),
//           name: profile.name ?? profile.login,
//           email: profile.email,
//           image: profile.avatar_url,
//         };
//       },
//     }),
//   ],
//   callbacks: {
//     async signIn({ user, account, profile }) {
//       if (account?.provider === "github" && profile) {
//         const githubProfile = profile as unknown as GithubProfile;
//         const githubId = String(githubProfile.id);
//         const username = githubProfile.login || profile.name || "Unknown";
//         const avatar = githubProfile.avatar_url || user.image || "";
//         const githubUrl = githubProfile.html_url || "";

//         await prisma.player.upsert({
//           where: { githubId },
//           update: {
//             username,
//             avatar,
//             githubUrl,
//             userId: user.id,
//           },
//           create: {
//             githubId,
//             username,
//             avatar,
//             githubUrl,
//             userId: user.id,
//             eloRating: 1000,
//             totalWins: 0,
//             totalLosses: 0,
//             currentStreak: 0,
//             badges: [],
//           },
//         });
//       }
//       return true;
//     },
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//       }
//       return token;
//     },
//     async session({ session, token }) {
//       if (token?.id) {
//         try {
//           const player = await prisma.player.findUnique({
//             where: { userId: token.id as string },
//           });

//           if (player) {
//             (session as { player?: unknown }).player = player;
//           }
//         } catch (error) {
//           console.error("Error extending session with player:", error);
//         }
//       }
//       return session;
//     },
//   },
//   session: {
//     strategy: "jwt",
//   },
//   pages: {
//     signIn: "/login",
//   },
//   debug: true,
// };
import { AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

interface GithubProfile {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  email?: string;
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as unknown as GithubProfile;
        const githubId = String(githubProfile.id);
        const username = githubProfile.login || user.name || "Unknown";
        const avatar = githubProfile.avatar_url || user.image || "";
        const githubUrl = githubProfile.html_url || "";

        try {
          // user.id is set by PrismaAdapter BEFORE signIn callback runs
          // but only on CREATE. On subsequent logins the user already exists.
          // We need to find the user by their GitHub account to get the real userId.
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "github",
                providerAccountId: String(githubProfile.id),
              },
            },
            include: { user: true },
          });

          // Use the userId from the existing account, or fall back to user.id
          const userId = existingAccount?.userId || user.id;

          if (!userId) {
            console.error("No userId available for player upsert");
            return true; // Still allow sign in, player creation will be retried
          }

          await prisma.player.upsert({
            where: { githubId },
            update: {
              username,
              avatar,
              githubUrl,
              userId,
            },
            create: {
              githubId,
              username,
              avatar,
              githubUrl,
              userId,
              eloRating: 1000,
              totalWins: 0,
              totalLosses: 0,
              currentStreak: 0,
              badges: [],
            },
          });
        } catch (error) {
          console.error("Error upserting player:", error);
          // Don't block sign in even if player upsert fails
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (token?.id) {
        try {
          const player = await prisma.player.findUnique({
            where: { userId: token.id as string },
          });
          if (player) {
            (session as { player?: unknown }).player = player;
          }
        } catch (error) {
          console.error("Error extending session with player:", error);
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};