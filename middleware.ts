import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/hub",
    "/lobby",
    "/friends",
    "/battle/:path*",
    "/profile/:path*",
    "/leaderboard",
    "/solo/:path*",
  ],
};
