import type { SignalTag } from "../../types";

const tagColors: Record<SignalTag, string> = {
  "Smart Money": "tag-blue",
  Accumulation: "badge-blue",
  Breakout: "badge-green",
  "Early Momentum": "badge-yellow",
  Trending: "badge-orange",
  Overheated: "badge-red",
  "High Risk": "badge-red",
};

export default function SignalTags({ tags }: { tags: SignalTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((t) => (
        <span key={t} className={tagColors[t] ?? "tag-blue"}>
          {t}
        </span>
      ))}
    </div>
  );
}
