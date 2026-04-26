export const BAND_LABEL = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  at_risk: "At Risk",
};

export const BAND_COLOR = {
  excellent: "#34D399",
  good: "#60A5FA",
  average: "#FBBF24",
  at_risk: "#FB7185",
};

export function Pill({ band, ...rest }) {
  if (!band) return null;
  return (
    <span className={`pill pill-${band}`} {...rest}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND_COLOR[band] }} />
      {BAND_LABEL[band]}
    </span>
  );
}
