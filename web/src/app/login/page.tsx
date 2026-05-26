// Sign-in page. Two-pane layout: branded gradient on the left, white
// sign-in card on the right. Server component — the form posts to a
// server action invoking Auth.js's signIn("google"). Auth.js redirects
// the user to Google, then back through /api/auth/callback/google; the
// signIn callback in src/auth.ts decides whether the verified email is
// allowed.

import { signIn } from "@/auth";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* Left 60% — branded gradient pane mirroring the dashboard header. */}
      <section
        className="flex flex-col items-center justify-center px-10 py-16 text-white md:w-3/5"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)",
        }}
      >
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Osmos CX Scorecard
        </h1>
        <p className="mt-4 max-w-md text-center text-base opacity-90">
          Client health monitoring & management dashboard.
        </p>
      </section>

      {/* Right 40% — sign-in form. */}
      <section className="flex flex-1 items-center justify-center bg-white px-8 py-16 md:w-2/5">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="flex w-full max-w-sm flex-col items-center gap-5"
        >
          <p className="text-center text-lg font-bold text-black">
            Use your Onlinesales or Osmos Google account.
          </p>
          <button
            type="submit"
            className="w-full rounded-md px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)",
            }}
          >
            Sign in with Google
          </button>
          {error === "AccessDenied" && (
            <p className="text-sm text-red-600">
              Access restricted to @onlinesales.ai and @osmos.ai accounts.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
