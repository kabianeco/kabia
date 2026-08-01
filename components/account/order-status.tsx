import type { OrderStatus } from "@/lib/orders-context";

const STATUS_LABELS: Record<OrderStatus, string> = {
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  "teslim-edildi": "Teslim edildi",
  "iptal-edildi": "İptal edildi",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  hazirlaniyor: "text-shell",
  kargoda: "text-olive",
  "teslim-edildi": "text-brand",
  "iptal-edildi": "text-clay",
};

/** Status as a tracked label rather than a coloured pill. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`label ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>
  );
}

const STEPS = [
  "Sipariş alındı",
  "Hazırlanıyor",
  "Kargoya verildi",
  "Teslim edildi",
];

const STATUS_TO_STEP: Record<Exclude<OrderStatus, "iptal-edildi">, number> = {
  hazirlaniyor: 1,
  kargoda: 2,
  "teslim-edildi": 3,
};

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "iptal-edildi") {
    return (
      <p className="border-l-2 border-clay py-3 pl-5 text-sm text-clay">
        Bu sipariş iptal edildi.
      </p>
    );
  }

  const currentStep = STATUS_TO_STEP[status];

  return (
    <ol className="grid grid-cols-4 border-t border-ink/10">
      {STEPS.map((label, i) => {
        const done = i <= currentStep;
        const isCurrent = i === currentStep;
        return (
          <li
            key={label}
            className={`border-t-2 pr-3 pt-4 transition-colors duration-300 ${
              done ? "border-brand" : "border-transparent"
            }`}
          >
            <span className="font-serif text-lg text-shell">0{i + 1}</span>
            <span
              className={`mt-1 block text-xs leading-snug ${
                isCurrent ? "text-ink" : done ? "text-ink/60" : "text-ink/35"
              }`}
            >
              {label}
              {isCurrent && <span className="sr-only"> — güncel durum</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
