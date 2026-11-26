import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { listDemoAccounts } from "@/lib/users";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Depthboard demo sign-in (credentials cookie session).",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/account";

  if (session) {
    redirect(nextPath);
  }

  const demos = listDemoAccounts();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Sign in</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Sign in</h1>
          <p>
            Session unlocks the athlete panel, consent edits and claim wizard.
            Operator / admin demos open the field app at{" "}
            <Link href="/field">/field</Link>.
          </p>
        </div>
      </div>
      <LoginForm nextPath={nextPath} demos={demos} />
      <p className="caption" style={{ marginTop: 20 }}>
        No account yet?{" "}
        <Link href="/claim">Start a profile claim</Link> after signing in with
        the fan demo, or read{" "}
        <Link href="/privacy">privacy</Link> for how claims@ works.
      </p>
    </div>
  );
}
