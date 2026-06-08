// Scattered, low-opacity cartoon art behind the whole app. Generated with
// gpt-image-2 and saved as static assets in /public/bg (zero runtime cost).
const tiles = [
  { src: "/bg/bg-manga.png", className: "left-[-4%] top-[6%] h-64 w-64 -rotate-6" },
  { src: "/bg/bg-noir.png", className: "right-[-3%] top-[12%] h-72 w-72 rotate-6" },
  { src: "/bg/bg-chibi.png", className: "left-[8%] bottom-[6%] h-56 w-56 rotate-3" },
  { src: "/bg/bg-noir.png", className: "right-[10%] bottom-[-4%] h-64 w-64 -rotate-3" },
  { src: "/bg/bg-manga.png", className: "left-[40%] top-[40%] h-72 w-72 rotate-2" },
];

export const BackgroundArt = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    {tiles.map((tile, index) => (
      <div
        key={index}
        className={`absolute rounded-3xl bg-cover bg-center opacity-[0.06] blur-[1px] ${tile.className}`}
        style={{ backgroundImage: `url(${tile.src})` }}
      />
    ))}
  </div>
);
