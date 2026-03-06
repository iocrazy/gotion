interface ToggleProps {
  active: boolean;
  onClick: () => void;
}

export function Toggle({ active, onClick }: ToggleProps) {
  return (
    <button
      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
        active ? "bg-red-500" : "bg-gray-300"
      }`}
      onClick={onClick}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
