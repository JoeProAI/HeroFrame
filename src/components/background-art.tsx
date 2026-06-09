// Scattered, low-opacity cartoon art behind the whole app. Generated with
// gpt-image-2 and saved as static assets in /public/bg (zero runtime cost).
const tiles = [
  { src: "/bg/bg-hero.png", className: "left-[2%] top-[4%] h-80 w-80 -rotate-6" },
  { src: "/bg/bg-manga.png", className: "right-[2%] top-[6%] h-96 w-96 rotate-6" },
  { src: "/bg/bg-chibi.png", className: "left-[20%] top-[40%] h-[26rem] w-[26rem] rotate-3" },
  { src: "/bg/bg-mecha.png", className: "right-[16%] top-[44%] h-[26rem] w-[26rem] -rotate-3" },
  { src: "/bg/bg-noir.png", className: "left-[4%] bottom-[2%] h-80 w-80 rotate-2" },
  { src: "/bg/bg-hero.png", className: "right-[4%] bottom-[1%] h-80 w-80 -rotate-2" },
];

// Sits behind the translucent panels so the cartoon art shows through the
// whole app instead of being hidden behind solid cards.
export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    {tiles.map((tile, index) => (
      <div
        key={index}
        className={`absolute rounded-[2rem] bg-contain bg-center bg-no-repeat opacity-[0.8] ${tile.className}`}
        style={{ backgroundImage: `url(${tile.src})` }}
      />
    ))}
  </div>
);
