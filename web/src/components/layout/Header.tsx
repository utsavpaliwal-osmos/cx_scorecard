// Top banner — purple gradient with the app title. Server component, no state.
export function Header() {
  return (
    <header
      className="mx-4 mt-4 rounded-2xl text-white py-10 px-8 text-center"
      style={{
        background: "linear-gradient(135deg, var(--brand-from) 0%, var(--brand-to) 100%)",
      }}
    >
      <h1 className="text-3xl font-bold tracking-tight">Osmos CX Scorecard</h1>
    </header>
  );
}
