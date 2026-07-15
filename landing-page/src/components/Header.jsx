import Image from "next/image";

export default function Header() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--border-color)",
      }}
      className="glass"
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 2rem",
        }}
      >
        <Image src="/logo.png" alt="ApplyKro logo" width={32} height={32} priority />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem" }}>
          ApplyKro
        </span>
      </div>
    </header>
  );
}
