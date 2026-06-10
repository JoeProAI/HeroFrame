// Cartoon art baked into the theme: a full-bleed mural that's desaturated and
// tinted into the indigo/amber palette, then scrimmed so it reads as ambient
// atmosphere rather than picture assets.
const tiles = [
  { src: "/bg/bg-hero.png", className: "left-[-4%] top-[-2%] h-[30rem] w-[30rem] -rotate-6" },
  { src: "/bg/bg-manga.png", className: "right-[-5%] top-[2%] h-[34rem] w-[34rem] rotate-6" },
  { src: "/bg/bg-chibi.png", className: "left-[22%] top-[34%] h-[32rem] w-[32rem] rotate-3" },
  { src: "/bg/bg-mecha.png", className: "right-[14%] top-[40%] h-[32rem] w-[32rem] -rotate-3" },
  { src: "/bg/bg-noir.png", className: "left-[-3%] bottom-[-6%] h-[30rem] w-[30rem] rotate-2" },
  { src: "/bg/bg-hero.png", className: "right-[-4%] bottom-[-8%] h-[30rem] w-[30rem] -rotate-2" },
];

export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    {/* desaturated cartoon layer */}
    <div className="absolute inset-0 opacity-[0.22]" style={{ filter: "grayscale(1) contrast(1.05)" }}>
      {tiles.map((tile, index) => (
        <div
          key={index}
          className={`absolute bg-contain bg-center bg-no-repeat ${tile.className}`}
          style={{ backgroundImage: `url(${tile.src})` }}
        />
      ))}
    </div>
    {/* palette tint poured over the grayscale art (duotone) */}
    <div
      className="absolute inset-0 mix-blend-color"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, #8a5cff, transparent 55%), radial-gradient(circle at 85% 15%, #2ec4b6, transparent 55%), radial-gradient(circle at 70% 95%, #ff5a3c, transparent 55%), #161033",
      }}
    />
    {/* depth scrim so panels and text stay readable */}
    <div
      className="absolute inset-0"
      style={{ background: "linear-gradient(180deg, #0c0a12aa 0%, #0c0a1266 45%, #0c0a12cc 100%)" }}
    />
  </div>
);
