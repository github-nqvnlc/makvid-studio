import Player from "./Player";
export default function Page() {
  return (
    <main style={{ padding: 24, display: "flex", gap: 32, flexWrap: "wrap" }}>
      <Player src="/comp-16x9/index.html" width={1920} height={1080} />
      <Player src="/comp-9x16/index.html" width={1080} height={1920} />
    </main>
  );
}
