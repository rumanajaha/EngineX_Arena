import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dynamic from "next/dynamic";

const LandingPageClient = dynamic(
  () => import("@/components/LandingPageClient"),
  { ssr: false }
);

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/hub");
  }

  return <LandingPageClient />;
}
