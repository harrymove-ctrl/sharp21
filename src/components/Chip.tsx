const CHIP_COLOR: Record<number, string> = {
  1: "#2563eb",
  2: "#15803d",
  5: "#dc2626",
};

export function Chip({
  value,
  onClick,
  disabled,
}: {
  value: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="sk-chip sk-chip-pop sk-chip--tap"
      style={{ background: CHIP_COLOR[value] ?? "#94a3b8" }}
      onClick={onClick}
      disabled={disabled}
    >
      {value}
    </button>
  );
}
