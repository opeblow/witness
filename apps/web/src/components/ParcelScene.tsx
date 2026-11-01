/**
 * Editorial illustration of a delivered parcel, used on the landing page.
 * The `edited` variant adds the tear a refund fraudster would paint in, and
 * `overlay` draws the fingerprint cells Witness flags for that edit.
 */
const W = 600;
const H = 450;
const CELL_W = W / 32;
const CELL_H = H / 32;

/** The grid cells covered by the painted tear, matching what the comparator reports. */
const TEAR_CELLS = (() => {
  const cells: Array<[number, number]> = [];
  for (let row = 21; row <= 25; row++) for (let col = 16; col <= 19; col++) cells.push([col, row]);
  return cells;
})();

export const TEAR_REGION = {
  x: (16 * CELL_W) / W,
  y: (21 * CELL_H) / H,
  width: (4 * CELL_W) / W,
  height: (5 * CELL_H) / H,
};

export function ParcelScene({ edited, overlay }: { edited: boolean; overlay: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="parcel-scene"
      role="img"
      aria-labelledby="parcel-title"
    >
      <title id="parcel-title">
        {edited
          ? 'A delivered parcel with a tear painted onto its front face'
          : 'A delivered parcel on a doorstep, undamaged'}
      </title>
      <defs>
        <clipPath id="parcel-top">
          <polygon points="140,215 250,184 480,212 370,245" />
        </clipPath>
        <pattern
          id="parcel-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="#5A4632" strokeWidth="0.6" opacity="0.35" />
        </pattern>
      </defs>

      <rect width={W} height="300" fill="#ECE6DA" />
      <rect y="300" width={W} height="150" fill="#E2DACB" />
      <rect y="288" width={W} height="12" fill="#D8CEBC" />
      <line x1="0" y1="300" x2={W} y2="300" stroke="#15130F" strokeOpacity="0.22" />
      <rect x="0" y="0" width="64" height="300" fill="#E4DCCD" />
      <line x1="64" y1="0" x2="64" y2="300" stroke="#15130F" strokeOpacity="0.15" />

      <ellipse cx="312" cy="392" rx="218" ry="20" fill="#15130F" opacity="0.1" />

      <g stroke="#5A4632" strokeWidth="1.2" strokeLinejoin="round">
        <polygon points="140,215 370,245 370,395 140,362" fill="#C9A47A" />
        <polygon points="370,245 480,212 480,355 370,395" fill="#AE885F" />
        <polygon points="140,215 250,184 480,212 370,245" fill="#DCC09A" />
      </g>
      <polygon points="370,245 480,212 480,355 370,395" fill="url(#parcel-hatch)" />

      <g clipPath="url(#parcel-top)">
        <polygon points="196.4,188.6 426.4,217.6 423.6,239.4 193.6,210.4" fill="#EADFC9" />
        <line x1="195" y1="199.5" x2="425" y2="228.5" stroke="#A9875F" strokeWidth="1" />
      </g>
      <polygon points="414,231.8 436,225.2 436,371 414,379" fill="#E3D6BC" opacity="0.92" />

      <g transform="translate(170 262) skewY(7.43)">
        <rect width="124" height="80" fill="#FBF9F4" stroke="#5A4632" strokeWidth="0.8" />
        <rect x="10" y="10" width="54" height="5" fill="#15130F" opacity="0.8" />
        <rect x="10" y="20" width="84" height="3" fill="#15130F" opacity="0.35" />
        <rect x="10" y="27" width="70" height="3" fill="#15130F" opacity="0.35" />
        <rect x="96" y="8" width="18" height="18" fill="none" stroke="#15130F" strokeWidth="1.2" />
        <circle cx="105" cy="17" r="3" fill="#D2451E" />
        {[
          0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 30, 32, 36, 39, 41, 45, 48, 52, 54, 57, 61, 64, 66,
          70, 73, 76, 80, 83, 86, 90, 93, 96, 100,
        ].map((x, i) => (
          <rect key={x} x={10 + x} y="44" width={i % 3 === 0 ? 2 : 1} height="26" fill="#15130F" />
        ))}
      </g>

      <path d="M332 391 L346 361 L370 353" fill="none" stroke="#8E6B47" strokeWidth="1.2" />
      <polygon points="346,361 370,353 370,394 332,391" fill="#B8936A" opacity="0.45" />

      {edited ? (
        <g>
          <polygon
            points="310,308 323,313 330,301 343,309 356,304 352,319 364,328 351,336 356,350 339,344 330,356 321,342 306,346 312,331 300,323 313,318"
            fill="#2E2116"
            stroke="#EADBC0"
            strokeWidth="3"
            strokeLinejoin="miter"
          />
          <path
            d="M317 320 L334 326 M326 336 L345 330 M322 313 L330 322"
            stroke="#6E5236"
            strokeWidth="1.2"
          />
        </g>
      ) : null}

      {overlay ? (
        <g>
          {TEAR_CELLS.map(([col, row]) => (
            <rect
              key={`${col}-${row}`}
              x={col * CELL_W}
              y={row * CELL_H}
              width={CELL_W}
              height={CELL_H}
              fill="#A8231A"
              opacity="0.22"
            />
          ))}
          <rect
            x={16 * CELL_W}
            y={21 * CELL_H}
            width={4 * CELL_W}
            height={5 * CELL_H}
            fill="none"
            stroke="#A8231A"
            strokeWidth="2.5"
          />
          <rect x={16 * CELL_W - 1} y={21 * CELL_H - 20} width="74" height="18" fill="#A8231A" />
          <text
            x={16 * CELL_W + 6}
            y={21 * CELL_H - 7}
            fill="#FBF9F4"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="10"
            letterSpacing="1"
          >
            CHANGED
          </text>
        </g>
      ) : null}
    </svg>
  );
}
