// Top banner — purple gradient with the app title, plus a small overlay
// in the top-right corner showing the signed-in user's email and a
// sign-out button. Server component: pulls the session synchronously from
// Auth.js.

import { auth, signOut } from "@/auth";

export async function Header() {
  const session = await auth();

  return (
    <header
      className="relative mx-4 mt-4 rounded-2xl text-white py-10 px-8 text-center"
      style={{
        background: "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)",
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight">Osmos CX Scorecard</h1>
      {session?.user?.email && (
        <div className="absolute right-5 top-5 flex items-center gap-4 text-sm">
          <span className="opacity-90">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-white/15 px-3.5 py-1.5 font-bold transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
