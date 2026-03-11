export function GotionLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M 70 30 C 60 15, 30 10, 20 40 C 15 65, 35 85, 60 80 C 80 75, 80 50, 80 50"
        stroke="#a5f3fc"
        strokeWidth="12"
        transform="translate(4, 4)"
      />
      <path
        d="M 70 30 C 60 15, 30 10, 20 40 C 15 65, 35 85, 60 80 C 80 75, 80 50, 80 50"
        stroke="currentColor"
        strokeWidth="12"
      />
      <path
        d="M 50 55 L 65 70 L 90 35"
        stroke="#fcd34d"
        strokeWidth="12"
      />
    </svg>
  );
}
