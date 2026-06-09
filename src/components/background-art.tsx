// Scattered, low-opacity cartoon art behind the whole app. Generated with
// gpt-image-2 and saved as static assets in /public/bg (zero runtime cost).
const tiles = [
  { src: "/bg/bg-manga.png", className: "left-[-3%] top-[4%] h-80 w-80 -rotate-6" },
  { src: "/bg/bg-noir.png", className: "right-[-4%] top-[8%] h-96 w-96 rotate-6" },
  { src: "/bg/bg-chibi.png", className: "left-[6%] bottom-[4%] h-72 w-72 rotate-3" },
  { src: "/bg/bg-noir.png", className: "right-[8%] bottom-[-5%] h-80 w-80 -rotate-3" },
  { src: "/bg/bg-manga.png", className: "left-[34%] top-[30%] h-[26rem] w-[26rem] rotate-2" },
  { src: "/bg/bg-chibi.png", className: "right-[30%] top-[55%] h-72 w-72 -rotate-2" },
];

// Sits behind the translucent panels so the cartoon art shows through the
// whole app instead of being hidden behind solid cards.
export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    {tiles.map((tile, index) => (
      <div
        key={index}
        className={`absolute rounded-[2rem] bg-cover bg-center opacity-[0.55] ${tile.className}`}
        style={{ backgroundImage: `url(${tile.src})` }}
      />
    ))}
  </div>
);
