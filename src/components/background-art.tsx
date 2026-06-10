// Cartoon art themed into the background: visible color cartoons across the
// whole viewport, with a soft palette tint so they feel part of the theme
// instead of pasted assets. Sits at z-0; app content renders above at z-1 and
// panels are translucent so this shows through.
const tiles = [
  { src: "/bg/bg-hero.png", className: "left-[-4%] top-[-2%] h-[30rem] w-[30rem] -rotate-6" },
  { src: "/bg/bg-manga.png", className: "right-[-5%] top-[2%] h-[34rem] w-[34rem] rotate-6" },
  { src: "/bg/bg-chibi.png", className: "left-[20%] top-[32%] h-[32rem] w-[32rem] rotate-3" },
  { src: "/bg/bg-mecha.png", className: "right-[12%] top-[38%] h-[32rem] w-[32rem] -rotate-3" },
  { src: "/bg/bg-noir.png", className: "left-[-3%] bottom-[-6%] h-[30rem] w-[30rem] rotate-2" },
  { src: "/bg/bg-hero.png", className: "right-[-4%] bottom-[-8%] h-[30rem] w-[30rem] -rotate-2" },
];

export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    {/* visible color cartoons */}
    <div className="absolute inset-0 opacity-40">
      {tiles.map((tile, index) => (
        <div
          key={index}
          className={`absolute bg-contain bg-center bg-no-repeat ${tile.className}`}
          style={{ backgroundImage: `url(${tile.src})` }}
        />
      ))}
    </div>
    {/* gentle palette tint so the art feels themed (soft-light keeps it bright) */}
    <div
      className="absolute inset-0 opacity-60"
      style={{
        mixBlendMode: "soft-light",
        background:
          "radial-gradient(circle at 15% 10%, #8a5cff, transparent 60%), radial-gradient(circle at 85% 12%, #2ec4b6, transparent 60%), radial-gradient(circle at 75% 95%, #ff5a3c, transparent 60%)",
      }}
    />
    {/* light scrim only at top and bottom so headers/footers stay readable */}
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(180deg, #0c0a1299 0%, transparent 22%, transparent 80%, #0c0a1299 100%)" }}
    />
  </div>
);
