/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useEffect, useState, useRef } from "react";
import {
  Search,
  X,
  Phone,
  Hash,
  User,
  FileText,
  CheckCircle2,
  Wallet,
  PackageCheck,
  FlaskConical,
  Banknote,
  Pencil,
  Eye,
  AlertCircle,
  Loader2,
  CreditCard,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import invoiceService from "../../../api/invoice";
import Modal from "../../../components/modal";
import Popup from "../../../components/popup";
import LoadingScreen from "../../../components/loadingPage";
import PrintId from "../../../components/PrintId";
import ScanButton from "../../../components/scanButton";
import { InvoiceDetailsModal, EditPatientModal } from "../invoiceList/index"; // ← extract from InvoiceList if needed

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n || 0);

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

const getDue = (inv) => Math.max(0, (inv.amount?.final ?? 0) - (inv.amount?.paid ?? 0));
const isFullyPaid = (inv) => getDue(inv) === 0;
const isDelivered = (inv) => inv.delivery?.status === true;
const hasReportSchemas = (inv) => (inv.tests ?? []).some((t) => t.schemaId);

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ── Detect what the user is typing ────────────────────────────────────────────
// Phone numbers are still detected strictly (7-15 digits, checked first, same
// as the backend's GET /invoice/search precedence). Anything else that's 6-7
// characters is treated as an invoice ID — free search, no fixed pattern.
const detectQueryType = (q) => {
  if (!q) return null;
  if (/^\d{7,15}$/.test(q)) return "phone";
  if (q.length >= 6 && q.length <= 7) return "invoiceId";
  return "name";
};

const QUERY_HINTS = {
  phone: { icon: Phone, color: "text-blue-500", label: "Searching by phone" },
  invoiceId: { icon: Hash, color: "text-violet-500", label: "Searching by Invoice ID" },
  name: { icon: User, color: "text-emerald-500", label: "Searching by name" },
};

// ─── Payment modes (mirrors CreateInvoice.jsx) ────────────────────────────────

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "others", label: "Others" },
];

// ─── Action chip ──────────────────────────────────────────────────────────────

const ActionChip = ({ onClick, icon: Icon, label, className }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${className}`}
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </button>
);

const LinkChip = ({ to, state, icon: Icon, label, className }) => (
  <Link
    to={to}
    state={state}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${className}`}
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </Link>
);

// ─── Collect Due modal ─────────────────────────────────────────────────────────

const CollectDueModal = ({ invoice, isOpen, onClose, onConfirm, onNetworkError }) => {
  const due = getDue(invoice);
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

  if (!isOpen) return null;

  const clampAmount = (val) => {
    if (val === "") return setAmount("");
    const num = parseFloat(val);
    if (Number.isNaN(num)) return setAmount("");
    setAmount(Math.min(Math.max(0, num), due));
  };

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0 && numericAmount <= due;

  const handleSubmit = async () => {
    if (!isValid) {
      setError(`Amount must be between ৳1 and ${fmt(due)}`);
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
        setError("Failed to collect due amount. Please try again.");
      }
      setSubmitting(false);
    }
  };

  const toFixed2 = (n) => parseFloat(n.toFixed(2));

  return (
    <Modal isOpen={isOpen} onClose={submitting ? undefined : onClose} size="sm">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Collect Due Amount</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              #{invoice.invoiceId} · {invoice.patient?.name}
            </p>
          </div>
          {!submitting && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between mb-5">
          <span className="text-xs font-semibold text-red-500">Total Due</span>
          <span className="text-lg font-bold text-red-600">{fmt(due)}</span>
        </div>

        {/* Amount */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount to Collect</label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="number"
              value={amount}
              onChange={(e) => clampAmount(e.target.value)}
              min="0"
              max={due}
              step="0.01"
              disabled={submitting}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-gray-50"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <button
              type="button"
              onClick={() => setAmount(due)}
              disabled={submitting}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Collect full due ({fmt(due)})
            </button>
            <span className="text-[11px] text-gray-400">Max {fmt(due)}</span>
          </div>
        </div>

        {/* Payment mode */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={submitting}
                onClick={() => setPaymentMode(mode.value)}
                aria-pressed={paymentMode === mode.value}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                  paymentMode === mode.value
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                    : "bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-4">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Collecting...
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" /> Collect {numericAmount > 0 ? fmt(numericAmount) : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Single result card ───────────────────────────────────────────────────────

const ResultCard = ({
  invoice,
  index,
  onDelivered,
  onCollected,
  onPatientUpdated,
  onLoadingChange,
  onError,
  onSuccess,
  onNetworkError, // new
}) => {
  const { date, time } = formatDateTime(invoice.createdAt);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [collectingDue, setCollectingDue] = useState(false);

  const due = getDue(invoice);
  const fullyPaid = isFullyPaid(invoice);
  const delivered = isDelivered(invoice);
  const hasReports = hasReportSchemas(invoice);
  const patient = invoice.patient;

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
        onError("Failed to mark as delivered. Please try again.");
      }
    } finally {
      onLoadingChange(null);
    }
  };

  const handleCollectDue = async ({ amount, paymentMode }) => {
    const { data } = await invoiceService.collectDue(invoice.invoiceId, { amount, paymentMode });
    onCollected(invoice.invoiceId, amount);
    setCollectingDue(false);
    onSuccess(
      data?.due > 0
        ? `Collected ${fmt(amount)} from ${patient.name}. Remaining due: ${fmt(data.due)}.`
        : `Collected ${fmt(amount)} from ${patient.name}. Invoice #${invoice.invoiceId} is now fully paid.`,
    );
  };

  return (
    <>
      {confirming && (
        <Popup
          type="warning"
          message={`Mark invoice #${invoice.invoiceId} for ${patient.name} as delivered? This cannot be undone.`}
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
        onNetworkError={onNetworkError} // pass down
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
      <EditPatientModal
        invoice={invoice}
        isOpen={editingPatient}
        onClose={() => setEditingPatient(false)}
        onSaved={onPatientUpdated}
        onLoadingChange={onLoadingChange}
        onError={onError}
      />

      <div className="space-y-2">
        {/* Barcode / QR print — same PrintId component used in Report.jsx, placed above the card */}
        <PrintId displayId={invoice.invoiceId} onError={onError} />

        <div className="bg-white shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-[11px] font-bold text-white">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{patient.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                #{invoice.invoiceId} · {date} · {time}
                {invoice.createdBy?.name && (
                  <span className="text-gray-300 hidden sm:inline"> · by {invoice.createdBy.name}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {fullyPaid ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-100 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-100 text-xs font-medium whitespace-nowrap">
                  <Wallet className="w-3 h-3" />৳{due.toLocaleString()}
                </span>
              )}
              {delivered && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold">
                  <PackageCheck className="w-3 h-3" />
                  <span className="hidden sm:inline">Delivered</span>
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap justify-start">
              <ActionChip
                onClick={() => setViewingDetails(true)}
                icon={Eye}
                label="Details"
                className="text-violet-700 bg-violet-50 hover:bg-violet-100 border-violet-100"
              />
              <LinkChip
                to={`/outdoor/invoice/print/${invoice.invoiceId}`}
                icon={FileText}
                label="Invoice"
                className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-100"
              />
              {hasReports && (
                <LinkChip
                  to="/report"
                  state={{ invoiceId: invoice.invoiceId }}
                  icon={FlaskConical}
                  label="Reports"
                  className="text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-transparent shadow-sm"
                />
              )}
              <ActionChip
                onClick={() => setEditingPatient(true)}
                icon={Pencil}
                label="Edit"
                className="text-gray-600 bg-gray-100 hover:bg-gray-200 border-gray-200"
              />
              {!fullyPaid && (
                <ActionChip
                  onClick={() => setCollectingDue(true)}
                  icon={CreditCard}
                  label="Collect"
                  className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                />
              )}
              {!delivered && (
                <ActionChip
                  onClick={() => setConfirming(true)}
                  icon={PackageCheck}
                  label="Deliver"
                  className="text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-100"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Main Search Component ────────────────────────────────────────────────────

const SearchInvoice = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [popup, setPopup] = useState(null);
  const [offlinePopup, setOfflinePopup] = useState(false);
  const [focused, setFocused] = useState(false);
  // Set only when the search response comes back with results: [] AND a
  // deletedInvoice payload — an exact invoiceId match that exists but was
  // soft-deleted (see GET /invoice/search's deletedInvoice field). Kept
  // separate from `results` so it renders its own distinct banner instead
  // of the plain "No invoices found" empty state.
  const [deletedInvoice, setDeletedInvoice] = useState(null);
  const debounceRef = useRef(null);

  const queryType = detectQueryType(query.trim());
  const hint = queryType ? QUERY_HINTS[queryType] : null;

  const runSearch = async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setDeletedInvoice(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await invoiceService.searchInvoices(q.trim());
      setResults(data.results);
      setDeletedInvoice(data.deletedInvoice ?? null);
      setSearched(true);
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setPopup({ type: "error", message: "Search failed. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 400);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setDeletedInvoice(null);
  };

  const handleScan = (text) => {
    clearTimeout(debounceRef.current);
    const q = text.trim();
    setQuery(q);
    runSearch(q);
  };

  // Optimistic updates
  const handleDelivered = (id) =>
    setResults((prev) =>
      prev.map((inv) => (inv.invoiceId === id ? { ...inv, delivery: { ...inv.delivery, status: true } } : inv)),
    );

  const handleCollected = (id, collectedAmount) =>
    setResults((prev) =>
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
    setResults((prev) => prev.map((inv) => (inv.invoiceId === id ? { ...inv, ...fields } : inv)));

  return (
    <section className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-6">
      {loadingMessage && <LoadingScreen message={loadingMessage} />}
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      <div className="max-w-2xl mx-auto">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Search className="w-6 h-6 text-indigo-600 shrink-0" /> Search Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">Search by phone number, invoice ID, or patient name</p>
        </div>

        {/* ── Search box ────────────────────────────────────────────────── */}
        <div className="relative mb-2">
          <div
            className={`flex items-center gap-2.5 h-[3.375rem] pl-4 pr-2 bg-white transition-all duration-200 ${
              focused || loading
                ? "shadow-[0_2px_20px_rgba(99,102,241,0.16)] ring-2 ring-indigo-500/70"
                : "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_1px_8px_rgba(15,23,42,0.04)] ring-1 ring-gray-200"
            }`}
          >
            <div className="shrink-0">
              {loading ? (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              ) : hint ? (
                <hint.icon className={`w-4 h-4 ${hint.color} transition-colors`} />
              ) : (
                <Search className={`w-4 h-4 transition-colors ${focused ? "text-indigo-500" : "text-gray-400"}`} />
              )}
            </div>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="01XXXXXXXXX  ·  090901  ·  Patient name"
              className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-300 focus:outline-none"
            />
            {query && (
              <button
                onClick={handleClear}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="w-px h-5 bg-gray-200 shrink-0" />
            <ScanButton
              onScan={handleScan}
              className="!border-0 !bg-transparent !p-2 !rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            />
          </div>
        </div>

        {/* ── Query type hint ────────────────────────────────────────────── */}
        {hint && query.trim().length >= 2 && (
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold mb-4 ${hint.color}`}>
            <hint.icon className="w-3 h-3" />
            {hint.label}
          </div>
        )}

        {/* ── Type guide pills ──────────────────────────────────────────── */}
        {!query && (
          <div className="flex flex-wrap gap-2 mb-6 mt-3">
            {[
              {
                icon: Phone,
                label: "Phone number",
                eg: "01XXXXXXXXX",
                color: "bg-blue-50 text-blue-600 border-blue-100",
              },
              {
                icon: Hash,
                label: "Invoice ID",
                eg: "090901",
                color: "bg-violet-50 text-violet-600 border-violet-100",
              },
              {
                icon: User,
                label: "Patient name",
                eg: "John Doe",
                color: "bg-emerald-50 text-emerald-600 border-emerald-100",
              },
            ].map(({ icon: Icon, label, eg, color }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${color}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                <span className="opacity-50 font-normal">e.g. {eg}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {searched && !loading && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">
              {results.length === 0
                ? "No results found"
                : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
            </p>
            {results.length > 0 && (
              <button onClick={handleClear} className="text-xs text-indigo-500 font-semibold hover:underline">
                Clear
              </button>
            )}
          </div>
        )}

        {searched && !loading && results.length === 0 && deletedInvoice && (
          <div className="bg-white border border-rose-200 rounded-2xl py-14 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-sm font-bold text-gray-700">Invoice #{deletedInvoice.invoiceId} has been deleted</p>
            <p className="text-xs text-gray-400 mt-1">
              {deletedInvoice.patientName && <>{deletedInvoice.patientName} · </>}
              {deletedInvoice.deletedAt && `Deleted ${formatDateTime(deletedInvoice.deletedAt).date}`}
              {deletedInvoice.deletedBy && ` by ${deletedInvoice.deletedBy}`}
            </p>
          </div>
        )}

        {searched && !loading && results.length === 0 && !deletedInvoice && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-400">No invoices found</p>
            <p className="text-xs text-gray-300 mt-1">Try a different phone, ID, or name</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((invoice, i) => (
              <ResultCard
                key={invoice._id}
                invoice={invoice}
                index={i}
                onDelivered={handleDelivered}
                onCollected={handleCollected}
                onPatientUpdated={handlePatientUpdated}
                onLoadingChange={(msg) => setLoadingMessage(msg)}
                onError={(msg) => setPopup({ type: "error", message: msg })}
                onSuccess={(msg) => setPopup({ type: "success", message: msg })}
                onNetworkError={() => setOfflinePopup(true)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchInvoice;
