// Smartly scattered cartoon cast as the background. Transparent character
// cutouts placed with depth: larger, blurred, fainter figures sit "far" while
// a few sharper ones anchor the corners. Sits at -z-10 behind the app; panels
// are translucent so the cast reads through the whole UI.
type Tile = {
  src: string;
  className: string;
  opacity: number;
  blur?: string;
};

const tiles: Tile[] = [
  // far layer — big, soft, faint (depth)
  { src: "/bg/cast-brute.webp", className: "left-[18%] top-[26%] h-[40rem] w-[40rem] -rotate-3", opacity: 0.1, blur: "blur(3px)" },
  { src: "/bg/cast-mecha.webp", className: "right-[14%] top-[30%] h-[38rem] w-[38rem] rotate-3", opacity: 0.1, blur: "blur(3px)" },

  // mid layer
  { src: "/bg/cast-mage.webp", className: "left-[30%] top-[2%] h-[22rem] w-[22rem] rotate-2", opacity: 0.16, blur: "blur(1px)" },
  { src: "/bg/cast-spark.webp", className: "right-[34%] bottom-[4%] h-[20rem] w-[20rem] -rotate-2", opacity: 0.16, blur: "blur(1px)" },

  // near layer — corners, sharper, a bit stronger
  { src: "/bg/cast-leader.webp", className: "left-[-5%] top-[1%] h-[30rem] w-[30rem] -rotate-6", opacity: 0.28 },
  { src: "/bg/cast-blade.webp", className: "right-[-6%] top-[6%] h-[32rem] w-[32rem] rotate-6", opacity: 0.26 },
  { src: "/bg/cast-mask.webp", className: "left-[-5%] bottom-[-6%] h-[30rem] w-[30rem] rotate-3", opacity: 0.26 },
  { src: "/bg/cast-beast.webp", className: "right-[-5%] bottom-[-7%] h-[30rem] w-[30rem] -rotate-3", opacity: 0.28 },
];

export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    {tiles.map((tile, index) => (
      <div
        key={index}
        className={`absolute bg-contain bg-center bg-no-repeat ${tile.className}`}
        style={{ backgroundImage: `url(${tile.src})`, opacity: tile.opacity, filter: tile.blur }}
      />
    ))}
    {/* gentle palette tint so the cast feels themed, not pasted */}
    <div
      className="absolute inset-0"
      style={{
        mixBlendMode: "soft-light",
        opacity: 0.5,
        background:
          "radial-gradient(circle at 15% 12%, #8a5cff, transparent 60%), radial-gradient(circle at 85% 14%, #2ec4b6, transparent 60%), radial-gradient(circle at 72% 92%, #ff5a3c, transparent 60%)",
      }}
    />
    {/* soft vignette so edges settle and center stays readable */}
    <div
      className="absolute inset-0"
      style={{ background: "radial-gradient(circle at 50% 45%, transparent 55%, #0c0a1288 100%)" }}
    />
  </div>
);
