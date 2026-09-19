// Pawn + padlock: the Passwars mark, sized up for the auth screens.
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="1" y="1" width="46" height="46" rx="9" fill="#1c1a14" stroke="#3a3527" />

      {/* pawn */}
      <circle cx="24" cy="12" r="4.5" fill="#d9b65c" />
      <rect x="19" y="17.5" width="10" height="2.5" rx="1" fill="#d9b65c" />
      <path d="M20.5 21h7l2 9h-11z" fill="#d9b65c" />
      <rect x="15" y="30.5" width="18" height="3.5" rx="1" fill="#d9b65c" />

      {/* padlock */}
      <path
        d="M33 36v-2.5a3 3 0 0 1 6 0V36"
        fill="none"
        stroke="#f4eddc"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="31" y="36" width="10" height="7" rx="1.5" fill="#f4eddc" />
      <circle cx="36" cy="39.5" r="1.1" fill="#1c1a14" />
    </svg>
  );
}
