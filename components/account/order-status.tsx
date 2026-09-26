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

const STEPS: { label: string; status: OrderStatus | "alindi" }[] = [
  { label: "Sipariş alındı", status: "alindi" },
  { label: "Hazırlanıyor", status: "hazirlaniyor" },
  { label: "Kargoya verildi", status: "kargoda" },
  { label: "Teslim edildi", status: "teslim-edildi" },
];

const STATUS_TO_STEP: Record<Exclude<OrderStatus, "iptal-edildi">, number> = {
  hazirlaniyor: 1,
  kargoda: 2,
  "teslim-edildi": 3,
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

/**
 * The order's progress. Dates come from the recorded status history (the
 * first time each status was reached); a step without a record shows none
 * rather than an invented one. Stacks vertically on narrow screens.
 */
export function OrderStatusTimeline({
  status,
  placedAt,
  history = [],
}: {
  status: OrderStatus;
  placedAt?: string;
  history?: { status: OrderStatus; at: string }[];
}) {
  const reachedAt = (step: OrderStatus | "alindi") =>
    step === "alindi" ? placedAt : history.find((h) => h.status === step)?.at;

  if (status === "iptal-edildi") {
    const cancelledAt = reachedAt("iptal-edildi");
    return (
      <p className="border-l-2 border-clay py-3 pl-5 text-sm text-clay">
        Bu sipariş iptal edildi{cancelledAt ? ` (${shortDate(cancelledAt)})` : ""}.
      </p>
    );
  }

  const currentStep = STATUS_TO_STEP[status];

  return (
    <ol className="grid border-t border-ink/10 sm:grid-cols-4">
      {STEPS.map((step, i) => {
        const done = i <= currentStep;
        const isCurrent = i === currentStep;
        const at = done ? reachedAt(step.status) : undefined;
        return (
          <li
            key={step.label}
            className={`flex items-baseline gap-4 border-b border-ink/10 py-3 transition-colors duration-300 sm:block sm:border-b-0 sm:border-t-2 sm:pr-3 sm:pt-4 ${
              done ? "sm:border-brand" : "sm:border-transparent"
            }`}
          >
            <span className={`font-serif text-lg ${done ? "text-brand" : "text-shell"}`}>0{i + 1}</span>
            <span
              className={`block text-xs leading-snug sm:mt-1 ${
                isCurrent ? "text-ink" : done ? "text-ink/60" : "text-ink/35"
              }`}
            >
              {step.label}
              {isCurrent && <span className="sr-only"> — güncel durum</span>}
              {at && <span className="block text-ink/45">{shortDate(at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
