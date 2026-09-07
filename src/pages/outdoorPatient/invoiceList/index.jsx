/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle2,
  ArrowLeft,
  Wallet,
  AlertCircle,
  PackageCheck,
  FlaskConical,
  Banknote,
  Pencil,
  User,
  Phone,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  UserCircle,
  Receipt,
  TestTube2,
  DollarSign,
  UserCheck,
  Clock,
  Printer,
  Copy,
  Check,
  CreditCard,
  Loader2,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Popup from "../../../components/popup";
import Modal from "../../../components/modal";
import LoadingScreen from "../../../components/loadingPage";
import invoiceService from "../../../api/invoice";
import TimeFrame from "../../../components/timeFrame";
import { useAuthStore } from "../../../store/authStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n || 0);

const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "0");

const formatDateTime = (ts) => {
  const d = new Date(ts);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day % 100 !== 11
      ? "st"
      : day % 10 === 2 && day % 100 !== 12
        ? "nd"
        : day % 10 === 3 && day % 100 !== 13
          ? "rd"
          : "th";
  const h = d.getHours();
  return {
    date: `${day}${suffix} ${d.toLocaleString("default", { month: "short" })}, ${d.getFullYear()}`,
    time: `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
  };
};

// Compact "relative-ish" line used on cards: "7th Sep, 2026 · 4:32 PM"
const formatDateTimeLine = (ts) => {
  const { date, time } = formatDateTime(ts);
  return `${date} · ${time}`;
};

const getDue = (inv) => Math.max(0, (inv.amount?.final ?? 0) - (inv.amount?.paid ?? 0));
const isFullyPaid = (inv) => getDue(inv) === 0;
const isDelivered = (inv) => inv.delivery?.status === true;
const getTests = (inv) => inv.tests ?? [];
const hasReportSchemas = (inv) => getTests(inv).some((t) => t.schemaId);

// Clipboard helper — uses the async Clipboard API where available and falls
// back to the legacy execCommand approach for non-secure contexts / older webviews.
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy method
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

// ── Error helpers ─────────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";

const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ─── Payment modes (mirrors CreateInvoice.jsx / SearchInvoice.jsx) ───────────

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "others", label: "Others" },
];

// ─── Copy Invoice ID Button ───────────────────────────────────────────────────

const CopyIdButton = ({ value, size = "xs" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyToClipboard(String(value));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const dims = size === "sm" ? "w-6 h-6" : "w-5 h-5";
  const iconDims = size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5";

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "কপি হয়েছে" : "আইডি কপি করুন"}
      aria-label="Copy invoice ID"
      className={`relative shrink-0 ${dims} flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all`}
    >
      {copied ? <Check className={`${iconDims} text-emerald-600`} /> : <Copy className={iconDims} />}
    </button>
  );
};

// ─── Collect Due Modal ────────────────────────────────────────────────────────

const CollectDueModal = ({ invoice, isOpen, onClose, onConfirm, onNetworkError }) => {
  const due = invoice ? getDue(invoice) : 0;
  const [amount, setAmount] = useState(due);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount(due);
      setPaymentMode("cash");
      setError("");
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoice?.invoiceId]);

  if (!isOpen || !invoice) return null;

  const clampAmount = (val) => {
    if (val === "") return setAmount("");
    const num = parseFloat(val);
    if (Number.isNaN(num)) return setAmount("");
    setAmount(Math.min(Math.max(0, num), due));
  };

  const toFixed2 = (n) => parseFloat(n.toFixed(2));
  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0 && numericAmount <= due;

  const handleSubmit = async () => {
    if (!isValid) {
      setError(`পরিমাণ ৳১ থেকে ${fmt(due)} এর মধ্যে হতে হবে`);
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await onConfirm({ amount: toFixed2(numericAmount), paymentMode });
    } catch (err) {
      if (isNetworkError(err)) {
        setError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        onNetworkError?.();
      } else {
        setError("আদায় ব্যর্থ হয়েছে, আবার চেষ্টা করুন।");
      }
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={submitting ? undefined : onClose} size="sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">বকেয়া আদায়</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              #{invoice.invoiceId} · {invoice.patient?.name}
            </p>
          </div>
        </div>
        {!submitting && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-red-100 bg-red-50">
          <span className="text-xs font-medium uppercase tracking-wide text-red-600">মোট বাকি</span>
          <span className="text-lg font-bold text-red-600 tabular-nums">{fmt(due)}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">আদায়কৃত পরিমাণ</label>
          <div className="relative">
            <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => clampAmount(e.target.value)}
              min="0"
              max={due}
              step="0.01"
              disabled={submitting}
              className="w-full pl-10 pr-3 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50 focus:bg-white disabled:opacity-60"
            />
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <button
              type="button"
              onClick={() => setAmount(due)}
              disabled={submitting}
              className="text-xs font-medium text-emerald-600 hover:underline"
            >
              সম্পূর্ণ বাকি আদায় করুন ({fmt(due)})
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">পেমেন্ট মাধ্যম</label>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={submitting}
                onClick={() => setPaymentMode(mode.value)}
                aria-pressed={paymentMode === mode.value}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                  paymentMode === mode.value
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>

      <div className="flex gap-2 px-5 pb-5 pt-1">
        <button
          onClick={onClose}
          disabled={submitting}
          className="flex-1 py-3 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
        >
          বাতিল
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="flex-1 py-3 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> আদায় হচ্ছে...
            </>
          ) : (
            <>
              <Banknote className="w-4 h-4" /> আদায় করুন {numericAmount > 0 ? `(${fmt(numericAmount)})` : ""}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

// ─── Invoice Card ──────────────────────────────────────────────────────────────

const InvoiceCard = ({
  invoice,
  index,
  onDelivered,
  onCollected,
  onPatientUpdated,
  onLoadingChange,
  onError,
  onSuccess,
  onNetworkError,
}) => {
  const { date, time } = formatDateTime(invoice.createdAt);
  const [confirming, setConfirming] = useState(false);
  const [collectingDue, setCollectingDue] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const due = getDue(invoice);
  const fullyPaid = isFullyPaid(invoice);
  const delivered = isDelivered(invoice);
  const hasReports = hasReportSchemas(invoice);
  const patient = invoice.patient;
  const creatorName = invoice.createdBy?.name;

  const handleConfirmDelivery = async () => {
    setConfirming(false);
    try {
      onLoadingChange("Marking as delivered...");
      await invoiceService.markDelivered(invoice.invoiceId);
      onDelivered(invoice.invoiceId);
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError?.();
      } else {
        onError(getErrorMessage(err, "Failed to mark as delivered. Please try again."));
      }
    } finally {
      onLoadingChange(null);
    }
  };

  const handleCollectDue = async ({ amount, paymentMode }) => {
    try {
      const { data } = await invoiceService.collectDue(invoice.invoiceId, { amount, paymentMode });
      onCollected(invoice.invoiceId, amount);
      setCollectingDue(false);
      onSuccess(
        data?.due > 0
          ? `${patient.name} থেকে ${fmt(amount)} আদায় হয়েছে। অবশিষ্ট বাকি: ${fmt(data.due)}।`
          : `${patient.name} থেকে ${fmt(amount)} আদায় হয়েছে। ইনভয়েস #${invoice.invoiceId} সম্পূর্ণ পরিশোধিত।`,
      );
    } catch (err) {
      throw err; // let CollectDueModal catch it
    }
  };

  return (
    <>
      {confirming && (
        <Popup
          type="warning"
          message={`Mark invoice #${invoice.invoiceId} for ${patient.name} as delivered? This action cannot be undone.`}
          confirmText="Mark Delivered"
          cancelText="Cancel"
          onConfirm={handleConfirmDelivery}
          onClose={() => setConfirming(false)}
        />
      )}

      <CollectDueModal
        invoice={invoice}
        isOpen={collectingDue}
        onClose={() => setCollectingDue(false)}
        onConfirm={handleCollectDue}
        onNetworkError={onNetworkError}
      />

      <EditPatientModal
        invoice={invoice}
        isOpen={editingPatient}
        onClose={() => setEditingPatient(false)}
        onSaved={onPatientUpdated}
        onLoadingChange={onLoadingChange}
        onError={onError}
        onNetworkError={onNetworkError}
      />
      <InvoiceDetailsModal
        invoiceId={invoice.invoiceId}
        isOpen={viewingDetails}
        onClose={() => setViewingDetails(false)}
        invoice={invoice}
        onPatientUpdated={onPatientUpdated}
        onLoadingChange={onLoadingChange}
        onError={onError}
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Top row: patient + status */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-slate-300 tabular-nums shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[15px] font-semibold text-slate-900 truncate">{patient.name}</h3>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="font-mono">#{invoice.invoiceId}</span>
              <CopyIdButton value={invoice.invoiceId} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-slate-900 tabular-nums">{fmt(invoice.amount?.final ?? 0)}</p>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              {delivered && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                  <PackageCheck className="w-3 h-3" /> ডেলিভারি
                </span>
              )}
              {fullyPaid ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">পরিশোধিত</span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 tabular-nums">
                  বাকি {fmt(due)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Created-by / timestamp strip — kept plain, always visible (glanceable, unlike the action buttons) */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-500 min-w-0">
            <UserCheck className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{creatorName || "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {date} · {time}
          </span>
        </div>

        {/* Actions tray — collapsed by default, expands on click; hidden on print */}
        <div className="px-4 pb-4 no-print">
          {actionsOpen ? (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <ActionChip onClick={() => setViewingDetails(true)} icon={Eye} label="Details" />
              <ActionLinkChip to={`/outdoor/invoice/print/${invoice.invoiceId}`} icon={FileText} label="Invoice" />
              {hasReports && (
                <ActionLinkChip
                  to="/report"
                  state={{ invoiceId: invoice.invoiceId }}
                  icon={FlaskConical}
                  label="Reports"
                  tone="red"
                />
              )}
              <ActionChip onClick={() => setEditingPatient(true)} icon={Pencil} label="Edit" />
              {!fullyPaid && (
                <ActionChip onClick={() => setCollectingDue(true)} icon={CreditCard} label="Collect Due" tone="green" />
              )}
              {!delivered && (
                <ActionChip onClick={() => setConfirming(true)} icon={PackageCheck} label="Delivery" tone="blue" />
              )}
              <button
                onClick={() => setActionsOpen(false)}
                className="shrink-0 ml-auto w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                aria-label="Hide actions"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActionsOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-500 border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" /> অ্যাকশন দেখুন
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Action chips ──────────────────────────────────────────────────────────────

const chipToneClasses = {
  default: "border-slate-200 text-slate-600 hover:bg-slate-50",
  green: "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
  blue: "border-blue-200 text-blue-600 hover:bg-blue-50",
  red: "border-red-200 text-red-600 hover:bg-red-50",
};

const ActionChip = ({ onClick, icon: Icon, label, tone = "default" }) => (
  <button
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${chipToneClasses[tone]}`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

const ActionLinkChip = ({ to, state, icon: Icon, label, tone = "default" }) => (
  <Link
    to={to}
    state={state}
    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${chipToneClasses[tone]}`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </Link>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const InvoiceList = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  // ═══════ Frontend permission check ═══════
  const hasAccess = isAdmin || !!user?.permissions?.invoiceList;
  if (!hasAccess) {
    return <Popup type="denied" message="ইনভয়েস লিস্ট দেখার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }
  // ══════════════════════════════════════════

  const [invoices, setInvoices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [popup, setPopup] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadInvoices = async (cursor = null, replace = true, range = timeRange) => {
    try {
      replace ? setInitialLoading(true) : (setLoadingMore(true), setLoadingMessage("Loading more invoices..."));
      const { data } = await invoiceService.getInvoices({
        cursor,
        limit: 20,
        ...(range && { startDate: range.start, endDate: range.end }),
      });
      setInvoices((prev) => (replace ? data.invoices : [...prev, ...data.invoices]));
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      if (isNetworkError(err)) {
        setNetworkError(true);
      } else {
        setPopup({ type: "error", message: getErrorMessage(err, "Could not load invoices") });
      }
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      setLoadingMessage(null);
    }
  };

  useEffect(() => {
    const now = new Date();
    const initial = { start: new Date(now).setHours(0, 0, 0, 0), end: new Date(now).setHours(23, 59, 59, 999) };
    setTimeRange(initial);
    loadInvoices(null, true, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetchData = (start, end) => {
    const range = { start, end };
    setTimeRange(range);
    setStatusFilter("all");
    loadInvoices(null, true, range);
  };

  const total = invoices.length;
  const totalPaid = invoices.reduce((s, inv) => s + (inv.amount?.paid ?? 0), 0);
  const totalDue = invoices.reduce((s, inv) => s + getDue(inv), 0);
  const totalBilled = invoices.reduce((s, inv) => s + (inv.amount?.final ?? 0), 0);

  const filteredInvoices = invoices
    .filter((inv) =>
      statusFilter === "pending" ? !isFullyPaid(inv) : statusFilter === "paid" ? isFullyPaid(inv) : true,
    )
    .filter((inv) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      return (
        inv.patient?.name?.toLowerCase().includes(q) ||
        inv.invoiceId?.toLowerCase().includes(q) ||
        inv.patient?.contactNumber?.includes(q)
      );
    });

  const headingLabel = (() => {
    if (!timeRange) return "";
    const s = new Date(timeRange.start);
    const e = new Date(timeRange.end);
    const day = (d) => {
      const n = d.getDate();
      const sfx =
        n % 10 === 1 && n % 100 !== 11
          ? "st"
          : n % 10 === 2 && n % 100 !== 12
            ? "nd"
            : n % 10 === 3 && n % 100 !== 13
              ? "rd"
              : "th";
      return `${n}${sfx}`;
    };
    const monthYear = (d) => `${d.toLocaleString("en-US", { month: "long" })}, ${d.getFullYear()}`;
    if (s.toDateString() === e.toDateString()) return `${day(s)} ${monthYear(s)}`;
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) return `${s.getDate()} – ${e.getDate()} ${monthYear(s)}`;
    return `${s.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  // Optimistic updates
  const handleDelivered = (id) =>
    setInvoices((prev) =>
      prev.map((inv) => (inv.invoiceId === id ? { ...inv, delivery: { ...inv.delivery, status: true } } : inv)),
    );

  const handleCollected = (id, collectedAmount) =>
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceId === id
          ? {
              ...inv,
              amount: {
                ...inv.amount,
                paid: Math.min(inv.amount.final, (inv.amount.paid || 0) + collectedAmount),
              },
            }
          : inv,
      ),
    );

  const handlePatientUpdated = (id, fields) =>
    setInvoices((prev) => prev.map((inv) => (inv.invoiceId === id ? { ...inv, ...fields } : inv)));

  return (
    <section className="min-h-screen bg-slate-50 pb-8 font-noto">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #invoicelist-printable, #invoicelist-printable * { visibility: visible; }
          #invoicelist-printable { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {loadingMessage && <LoadingScreen message={loadingMessage} />}
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {networkError && <Popup type="offline" onClose={() => setNetworkError(false)} />}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 no-print">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/outdoor"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">ইনভয়েস তালিকা</h1>
              <p className="text-[11px] text-slate-400 truncate">{fmtNum(total)}টি ইনভয়েস</p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            disabled={initialLoading}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* TimeFrame */}
        <div className="mb-4 no-print">
          <TimeFrame onFetchData={handleFetchData} />
        </div>

        {initialLoading ? (
          <SkeletonList />
        ) : (
          <div id="invoicelist-printable">
            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">ইনভয়েস লেজার</p>
                  <h2 className="text-lg font-bold text-slate-900">{headingLabel}</h2>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <SummaryStat label="মোট বিলকৃত" value={fmt(totalBilled)} />
                <SummaryStat label="আদায়" value={fmt(totalPaid)} tone="green" />
                <SummaryStat label="বাকি" value={fmt(totalDue)} tone={totalDue > 0 ? "red" : "green"} />
              </div>
            </div>

            {/* Search + filter — no-print */}
            <div className="mb-4 space-y-2 no-print">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="নাম, ফোন বা আইডি দিয়ে খুঁজুন..."
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { key: "all", label: "সব" },
                  { key: "pending", label: "বাকি" },
                  { key: "paid", label: "পরিশোধিত" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      statusFilter === key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice cards */}
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                <AlertCircle className="w-5 h-5" />
                <p className="text-xs">
                  {searchTerm.trim()
                    ? "কোনো ফলাফল পাওয়া যায়নি"
                    : statusFilter !== "all"
                      ? "এই ফিল্টারে কোনো ইনভয়েস নেই"
                      : "নির্ধারিত সময়সীমায় কোনো ইনভয়েস তৈরি হয়নি"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice, index) => (
                  <InvoiceCard
                    key={invoice._id}
                    invoice={invoice}
                    index={index}
                    onDelivered={handleDelivered}
                    onCollected={handleCollected}
                    onPatientUpdated={handlePatientUpdated}
                    onLoadingChange={(msg) => setLoadingMessage(msg)}
                    onError={(msg) => setPopup({ type: "error", message: msg })}
                    onSuccess={(msg) => setPopup({ type: "success", message: msg })}
                    onNetworkError={() => setNetworkError(true)}
                  />
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && statusFilter === "all" && (
              <button
                onClick={() => loadInvoices(nextCursor, false)}
                disabled={loadingMore}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 hover:text-slate-900 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed no-print"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                আরো লোড করুন (+20)
              </button>
            )}

            <p className="mt-4 text-center text-[10px] text-slate-400">
              শুধুমাত্র সক্রিয় (ডিলিট না হওয়া) ইনভয়েসের হিসাব অন্তর্ভুক্ত
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

const SummaryStat = ({ label, value, tone = "default" }) => {
  const toneClass = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-slate-900";
  return (
    <div className="bg-slate-50 rounded-xl px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className={`text-xs font-bold tabular-nums truncate ${toneClass}`}>{value}</p>
    </div>
  );
};

// ─── Invoice Details Modal ────────────────────────────────────────────────────

export const InvoiceDetailsModal = ({
  invoiceId,
  isOpen,
  onClose,
  invoice: invoiceRow,
  onPatientUpdated,
  onLoadingChange,
  onError,
}) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoice = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await invoiceService.getInvoiceByInvoiceId(invoiceId);
      setInvoice(res.data);
    } catch (err) {
      if (isNetworkError(err)) {
        setError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setError(getErrorMessage(err, "Failed to load invoice details."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !invoiceId) return;
    setInvoice(null);
    fetchInvoice();
  }, [isOpen, invoiceId]);

  const rowHasReports = hasReportSchemas(invoiceRow ?? {});
  const due = invoice ? getDue(invoice) : 0;
  const fullyPaid = invoice ? due === 0 : false;
  const delivered = invoice ? isDelivered(invoice) : false;
  const { date, time } = invoice ? formatDateTime(invoice.createdAt) : { date: "", time: "" };

  const patient = invoice?.patient ?? null;
  const referrer = invoice?.referrer ?? null;
  const amount = invoice?.amount ?? null;
  const createdBy = invoice?.createdBy ?? null;
  const deliveredBy = invoice?.delivery?.by ?? null;

  const hasReferrer = referrer && (referrer.name || referrer.id);
  const hasDiscount = (amount?.referrerDiscount ?? 0) > 0;
  const hasCommission = (amount?.referrerCommission ?? 0) > 0;
  const showSubtotal = hasDiscount || (amount?.labAdjustment ?? 0) > 0;

  const paymentModeLabel = (value) => PAYMENT_MODES.find((m) => m.value === value)?.label ?? value;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Invoice Details</h2>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-xs text-slate-400 font-mono">#{invoiceId}</p>
              <CopyIdButton value={invoiceId} size="sm" />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-4">
        {loading && <DetailsSkeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-xs text-slate-500">{error}</p>
            <button onClick={fetchInvoice} className="text-xs text-blue-600 hover:underline font-medium">
              আবার চেষ্টা করুন
            </button>
          </div>
        )}

        {invoice && !loading && (
          <>
            {/* Created-by / timestamp — prominent, at top of details */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-blue-500">তৈরি করেছেন</p>
                  <p className="text-xs font-semibold text-slate-900 truncate">{createdBy?.name ?? "—"}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wide text-blue-500">তারিখ ও সময়</p>
                <p className="text-xs font-semibold text-slate-900">
                  {date} · {time}
                </p>
              </div>
            </div>

            {/* Patient */}
            <ManifestBlock icon={UserCircle} label="রোগীর তথ্য">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <ManifestField label="Name" value={patient.name} />
                <ManifestField label="Gender" value={<span className="capitalize">{patient.gender}</span>} />
                <ManifestField label="Age" value={`${patient.age} yrs`} />
                <ManifestField label="Contact" value={patient.contactNumber} />
              </div>
            </ManifestBlock>

            {/* Delivery info */}
            {delivered && deliveredBy?.name && (
              <ManifestBlock icon={PackageCheck} label="ডেলিভারি">
                <ManifestField label="Delivered By" value={deliveredBy.name} valueClass="text-blue-600" />
              </ManifestBlock>
            )}

            {/* Referrer */}
            {hasReferrer && (
              <ManifestBlock icon={User} label="মিডিয়া">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <ManifestField label="Name" value={referrer.name || "—"} />
                  {referrer.type && (
                    <div>
                      <p className="text-[10px] uppercase text-slate-400 mb-0.5">Type</p>
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md capitalize ${
                          referrer.type === "doctor"
                            ? "bg-blue-100 text-blue-700"
                            : referrer.type === "agent"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-teal-100 text-teal-700"
                        }`}
                      >
                        {referrer.type}
                      </span>
                    </div>
                  )}
                  {hasDiscount && (
                    <ManifestField
                      label="Discount"
                      value={`- ${fmt(amount.referrerDiscount)}`}
                      valueClass="text-red-600"
                    />
                  )}
                  {hasCommission && (
                    <ManifestField
                      label="Commission"
                      value={fmt(amount.referrerCommission)}
                      valueClass="text-blue-600"
                    />
                  )}
                </div>
              </ManifestBlock>
            )}

            {/* Tests */}
            <ManifestBlock icon={TestTube2} label="টেস্ট সমূহ" badge={invoice.tests?.length ?? 0}>
              <div className="space-y-1">
                {(invoice.tests ?? []).map((t, i) => (
                  <div key={t.testId || i} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-slate-400 w-4 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-xs text-slate-900 flex-1 truncate">{t.name}</span>
                    <span className="flex-1 border-b border-dotted border-slate-200 translate-y-[-3px]" />
                    <span className="text-xs text-blue-600 tabular-nums shrink-0 font-medium">{fmt(t.price)}</span>
                  </div>
                ))}
              </div>
            </ManifestBlock>

            {/* Collection History */}
            {invoice.collections?.length > 0 && (
              <ManifestBlock icon={Clock} label="আদায় ইতিহাস" badge={invoice.collections.length}>
                <div className="space-y-1.5">
                  {invoice.collections.map((c, i) => {
                    const { date: cDate, time: cTime } = formatDateTime(c.at);
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-900 font-medium">{c.by?.name ?? "—"}</p>
                          <p className="text-[10px] text-slate-400">
                            {`${cDate} · ${cTime}`}
                            {c.mode && ` · ${paymentModeLabel(c.mode)}`}
                          </p>
                        </div>
                        <span className="text-sm text-emerald-600 tabular-nums font-semibold">{fmt(c.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </ManifestBlock>
            )}

            {/* Payment */}
            <ManifestBlock icon={DollarSign} label="পেমেন্ট বিবরণ">
              <div className="space-y-1.5 text-xs">
                {showSubtotal && <LedgerPayRow label="Subtotal" value={fmt(amount.initial)} />}
                {hasDiscount && (
                  <LedgerPayRow
                    label="Referrer Discount"
                    value={`- ${fmt(amount.referrerDiscount)}`}
                    valueClass="text-red-600"
                  />
                )}
                {(amount?.labAdjustment ?? 0) > 0 && (
                  <LedgerPayRow
                    label="Lab Adjustment"
                    value={`- ${fmt(amount.labAdjustment)}`}
                    valueClass="text-red-600"
                  />
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold text-slate-900">
                  <span>মোট</span>
                  <span className="text-blue-600">{fmt(amount.final)}</span>
                </div>
                <LedgerPayRow label="আদায়" value={fmt(amount.paid)} valueClass="text-emerald-600 font-semibold" />
                {invoice.paymentMode && (
                  <LedgerPayRow
                    label="সর্বশেষ মাধ্যম"
                    value={paymentModeLabel(invoice.paymentMode)}
                    valueClass="text-slate-500"
                  />
                )}
                {!fullyPaid ? (
                  <LedgerPayRow label="বাকি" value={fmt(due)} valueClass="text-red-600 font-semibold" />
                ) : (
                  <div className="flex items-center justify-end gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase">Fully Paid</span>
                  </div>
                )}
              </div>
            </ManifestBlock>

            {/* Status row */}
            <div className="flex items-center gap-2">
              <ManifestStatusBadge
                active={delivered}
                activeClass="text-blue-600 border-blue-200 bg-blue-50"
                inactiveClass="text-slate-400 border-slate-200"
                icon={PackageCheck}
                activeLabel="Delivered"
                inactiveLabel="Not Delivered"
              />
              <ManifestStatusBadge
                active={fullyPaid}
                activeClass="text-emerald-600 border-emerald-200 bg-emerald-50"
                inactiveClass="text-red-600 border-red-200 bg-red-50"
                icon={Wallet}
                activeLabel="Fully Paid"
                inactiveLabel={`Due ৳${due.toLocaleString()}`}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {invoiceRow && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-2.5 px-4 text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              বন্ধ করুন
            </button>
            <Link
              to={`/outdoor/invoice/print/${invoiceId}`}
              className="flex-1 py-2.5 text-xs font-semibold border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-colors text-center"
            >
              ইনভয়েস খুলুন
            </Link>
            {rowHasReports && (
              <Link
                to="/report"
                state={{ invoiceId }}
                className="flex-1 py-2.5 text-xs font-semibold border border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-colors text-center flex items-center justify-center gap-1.5"
              >
                <FlaskConical className="w-3 h-3" /> রিপোর্ট
              </Link>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

// ─── Edit Patient Modal ───────────────────────────────────────────────────────

export const EditPatientModal = ({ invoice, isOpen, onClose, onSaved, onLoadingChange, onError, onNetworkError }) => {
  const [form, setForm] = useState({ name: "", gender: "", age: "", contactNumber: "" });

  useEffect(() => {
    if (!invoice?.patient) return;
    const { name, gender, age, contactNumber } = invoice.patient;
    setForm({ name: name || "", gender: gender || "", age: age || "", contactNumber: contactNumber || "" });
  }, [invoice]);

  const isValid = form.name.trim() && form.gender && form.age && form.contactNumber.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    onClose();
    try {
      onLoadingChange("Updating patient info...");
      await invoiceService.updatePatientInfo(invoice.invoiceId, { patient: form });
      onSaved(invoice.invoiceId, { patient: { ...form, age: Number(form.age) } });
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError?.();
        onError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        onError(getErrorMessage(err, "Failed to update patient info. Please try again."));
      }
    } finally {
      onLoadingChange(null);
    }
  };

  const inputCls =
    "w-full pl-10 pr-3 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 focus:bg-white";
  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">রোগীর তথ্য সম্পাদনা</h2>
            <p className="text-xs text-slate-400 mt-0.5">Invoice #{invoice?.invoiceId}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4">
        <EditField label="Patient Name" required>
          <IconWrap icon={User}>
            <input type="text" value={form.name} onChange={set("name")} className={inputCls} placeholder="Full name" />
          </IconWrap>
        </EditField>

        <EditField label="Gender" required>
          <div className="flex gap-2">
            {["male", "female", "other"].map((g) => (
              <label
                key={g}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer text-xs font-medium capitalize transition-all select-none ${
                  form.gender === g
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="edit-gender"
                  value={g}
                  checked={form.gender === g}
                  onChange={() => setForm((p) => ({ ...p, gender: g }))}
                  className="sr-only"
                />
                {g}
              </label>
            ))}
          </div>
        </EditField>

        <div className="grid grid-cols-2 gap-3">
          <EditField label="Age" required>
            <IconWrap icon={Calendar}>
              <input
                type="number"
                inputMode="numeric"
                value={form.age}
                onChange={set("age")}
                className={inputCls}
                placeholder="e.g. 32"
                min="0"
                max="150"
              />
            </IconWrap>
          </EditField>
          <EditField label="Contact" required>
            <IconWrap icon={Phone}>
              <input
                type="tel"
                inputMode="tel"
                value={form.contactNumber}
                onChange={set("contactNumber")}
                className={inputCls}
                placeholder="01XXXXXXXXX"
              />
            </IconWrap>
          </EditField>
        </div>
      </div>

      <div className="flex gap-2 px-5 pb-5 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-3 text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
        >
          বাতিল
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1 py-3 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
        >
          সংরক্ষণ করুন
        </button>
      </div>
    </Modal>
  );
};

// ─── Shared Modal Primitives ──────────────────────────────────────────────────

const ManifestBlock = ({ icon: Icon, label, badge, children }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</span>
      </div>
      {badge !== undefined && <span className="text-[10px] text-slate-400">{badge}টি</span>}
    </div>
    {children}
  </div>
);

const ManifestField = ({ label, value, valueClass = "text-slate-900" }) => (
  <div>
    <p className="text-[10px] uppercase text-slate-400 mb-0.5">{label}</p>
    <p className={`font-semibold text-xs leading-snug ${valueClass}`}>{value}</p>
  </div>
);

const LedgerPayRow = ({ label, value, valueClass = "text-slate-900" }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-slate-500 flex-1">{label}</span>
    <span className="flex-1 border-b border-dotted border-slate-200 translate-y-[-3px]" />
    <span className={`shrink-0 ${valueClass}`}>{value}</span>
  </div>
);

const ManifestStatusBadge = ({ active, activeClass, inactiveClass, icon: Icon, activeLabel, inactiveLabel }) => (
  <span
    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wide border ${active ? activeClass : inactiveClass}`}
  >
    <Icon className="w-3.5 h-3.5" />
    {active ? activeLabel : inactiveLabel}
  </span>
);

const EditField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const IconWrap = ({ icon: Icon, children }) => (
  <div className="relative">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    {children}
  </div>
);

// ─── Skeletons ─────────────────────────────────────────────────────────────────

const SkeletonList = () => (
  <div className="space-y-3 animate-pulse">
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="h-4 w-40 bg-slate-100 rounded" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
        </div>
        <div className="h-8 bg-slate-100 rounded-xl" />
        <div className="flex gap-1.5">
          <div className="h-7 w-16 bg-slate-100 rounded-lg" />
          <div className="h-7 w-16 bg-slate-100 rounded-lg" />
          <div className="h-7 w-16 bg-slate-100 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

const DetailsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
      <div className="h-3 bg-slate-100 rounded w-1/3" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 bg-slate-100 rounded w-1/2" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
      <div className="h-3 bg-slate-100 rounded w-1/4" />
      {[1, 2].map((i) => (
        <div key={i} className="flex justify-between items-center">
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-1/5" />
        </div>
      ))}
    </div>
  </div>
);

export default InvoiceList;
