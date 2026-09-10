import ReactDOM from "react-dom";
// React Compiler active — no useCallback/useMemo

// ─── Constants ────────────────────────────────────────────────────────────────

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// NOTE: EXPENSE_TYPES and a days() helper previously lived here but were unused
// by every file in this module (AddItemsToPatient.jsx has its own local
// TypeBadge map, and BillingSummary.jsx computes day counts inline via
// calcBedAccrual). Removed as dead code. If another page outside this module
// imports either, restore them there instead of re-adding here.

// ─── Formatting ───────────────────────────────────────────────────────────────

export const fmt = {
  currency: (n) => `৳${new Intl.NumberFormat("en-BD", { minimumFractionDigits: 0 }).format(n ?? 0)}`,
  date: (ts) =>
    ts ? new Date(ts).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" }) : "—",
  datetime: (ts) =>
    ts
      ? new Date(ts).toLocaleString("en-BD", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  // patient.patient.age is now { years, months, days } instead of a plain number
  age: (age) => {
    if (!age) return "—";
    const years = age.years ?? 0;
    const months = age.months ?? 0;
    const days = age.days ?? 0;
    if (years > 0) return months > 0 ? `${years} বছর ${months} মাস` : `${years} বছর`;
    if (months > 0) return days > 0 ? `${months} মাস ${days} দিন` : `${months} মাস`;
    return `${days} দিন`;
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const totalExpenses = (expenses = []) => expenses.reduce((s, e) => s + (e.price ?? 0) * (e.quantity ?? 1), 0);

export const totalPayments = (payments = []) => payments.reduce((s, p) => s + (p.amount ?? 0), 0);

// ─── UI Primitives ────────────────────────────────────────────────────────────

export const Sk = ({ cls = "" }) => <div className={`animate-pulse rounded bg-slate-200 ${cls}`} />;

export const Badge = ({ children, color = "slate" }) => {
  const colors = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${colors[color]}`}
    >
      {children}
    </span>
  );
};

export const Field = ({ label, children, required }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

export const Input = ({ ...props }) => (
  <input
    {...props}
    className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${props.className ?? ""}`}
  />
);

export const Select = ({ children, ...props }) => (
  <select
    {...props}
    className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${props.className ?? ""}`}
  >
    {children}
  </select>
);

export const Textarea = ({ ...props }) => (
  <textarea
    {...props}
    rows={props.rows ?? 3}
    className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none ${props.className ?? ""}`}
  />
);

export const Btn = ({ children, variant = "primary", size = "md", loading, ...props }) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200",
    ghost: "hover:bg-slate-100 text-slate-600",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200",
  };
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5", lg: "text-sm px-5 py-3" };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${props.className ?? ""}`}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
};

export const PageHeader = ({ title, subtitle, back, action }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      {back && (
        <button
          onClick={back}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const SectionCard = ({ title, icon, children, action }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

export const ErrorMsg = ({ msg }) =>
  msg ? (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {msg}
    </div>
  ) : null;

export const EmptyState = ({ icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
    <div className="text-4xl mb-3 opacity-40">{icon}</div>
    <p className="font-semibold text-slate-500">{title}</p>
    {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
  </div>
);

export const BedSelector = ({ space, value, onChange }) => {
  if (!space?.multiBed || !space?.multiBedConf) return null;
  const { totalNumberOfBed, bedStartingNumber, booked = [], reserved = [] } = space.multiBedConf;
  const beds = Array.from({ length: totalNumberOfBed }, (_, i) => bedStartingNumber + i);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Bed</p>
      <div className="flex flex-wrap gap-2">
        {beds.map((bed) => {
          const isBooked = booked.includes(bed);
          const isReserved = reserved.some((r) => r.bedNumber === bed);
          const isSelected = value === bed;
          const isAvailable = !isBooked && !isReserved;
          return (
            <button
              key={bed}
              type="button"
              disabled={!isAvailable}
              onClick={() => onChange(isSelected ? null : bed)}
              className={`w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all ${
                isBooked
                  ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                  : isReserved
                    ? "bg-amber-50 border-amber-200 text-amber-400 cursor-not-allowed"
                    : isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {bed}
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2">
        {[
          { color: "bg-white border-slate-200", label: "Available" },
          { color: "bg-red-50 border-red-200", label: "Occupied" },
          { color: "bg-amber-50 border-amber-200", label: "Reserved" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${item.color}`} />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Modal = ({ open, onClose, title, children, width = "max-w-2xl" }) => {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(15,23,42,0.4)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${width} bg-white rounded-2xl border border-slate-200/80`}
        style={{
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{ flexShrink: 0 }}
          className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
        >
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
};
