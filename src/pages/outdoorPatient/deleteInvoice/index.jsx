/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useEffect, useState } from "react";
import {
  Trash2,
  Search,
  AlertTriangle,
  ChevronDown,
  X,
  PackageSearch,
  User,
  Phone,
  FileText,
  FlaskConical,
  CheckCircle2,
  Wallet,
  History,
  ArrowLeft,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Popup from "../../../components/popup";
import LoadingScreen from "../../../components/loadingPage";
import invoiceService from "../../../api/invoice";
import TimeFrame from "../../../components/timeFrame";
import { useAuthStore } from "../../../store/authStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (ts) => {
  if (!ts) return { date: "—", time: "" };
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

const getDue = (inv) => Math.max(0, (inv?.amount?.final ?? 0) - (inv?.amount?.paid ?? 0));

// ── Error helpers ─────────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";

const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ─── Delete Invoice Panel ─────────────────────────────────────────────────────

const DeleteInvoicePanel = ({ onDeleted, onLoadingChange, onError, onNetworkError }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [alreadyDeleted, setAlreadyDeleted] = useState(null);
  const [confirmPopup, setConfirmPopup] = useState(false);

  const fetchInvoice = async (id) => {
    try {
      setSearching(true);
      setNotFound(false);
      setAlreadyDeleted(null);
      setInvoice(null);
      const { data } = await invoiceService.getInvoiceByInvoiceId(String(id).trim());
      if (data.deletion?.status) {
        setAlreadyDeleted(data);
      } else {
        setInvoice(data);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError();
      } else if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        onError(getErrorMessage(err, "Failed to load invoice."));
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) fetchInvoice(q);
  };

  const handleClear = () => {
    setSearchQuery("");
    setInvoice(null);
    setNotFound(false);
    setAlreadyDeleted(null);
  };

  const handleConfirmDelete = async () => {
    setConfirmPopup(false);
    try {
      onLoadingChange("Deleting invoice...");
      await invoiceService.deleteInvoice(invoice.invoiceId);
      onDeleted(invoice.invoiceId);
      setInvoice(null);
      setSearchQuery("");
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError();
      } else {
        onError(
          err?.response?.status === 400
            ? "Invoice is already deleted."
            : getErrorMessage(err, "Failed to delete invoice. Please try again."),
        );
      }
    } finally {
      onLoadingChange(null);
    }
  };

  const due = getDue(invoice);
  const final = invoice?.amount?.final ?? 0;
  const onlineTests = invoice?.tests?.filter((t) => t.schemaId) ?? [];
  const offlineTests = invoice?.tests?.filter((t) => !t.schemaId) ?? [];

  return (
    <div className="space-y-4">
      {confirmPopup && invoice && (
        <Popup
          type="warning"
          message={`Delete invoice #${invoice.invoiceId} for ${invoice.patient?.name}? It will be hidden from all active lists.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onClose={() => setConfirmPopup(false)}
        />
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Search invoice to delete</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Enter invoice ID… e.g. 09090"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder-gray-400 font-mono"
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || searching}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {searching ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
            ) : (
              "Search"
            )}
          </button>
        </div>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center">
          <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Invoice not found</p>
          <p className="text-xs text-gray-400 mt-1">
            No active invoice found with ID{" "}
            <span className="font-mono font-semibold text-gray-600">#{searchQuery}</span>
          </p>
        </div>
      )}

      {/* Already deleted */}
      {alreadyDeleted && (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 text-center">
          <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Invoice #{alreadyDeleted.invoiceId} is already deleted</p>
          <p className="text-xs text-gray-400 mt-1">
            {alreadyDeleted.deletion?.by?.name
              ? `Deleted by ${alreadyDeleted.deletion.by.name} · ${formatDateTime(alreadyDeleted.deletion.at).date} · ${formatDateTime(alreadyDeleted.deletion.at).time}`
              : `Deleted on ${formatDateTime(alreadyDeleted.deletion?.at).date} · ${formatDateTime(alreadyDeleted.deletion?.at).time}`}
          </p>
        </div>
      )}

      {/* Invoice preview */}
      {invoice && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wide font-medium mb-0.5">Invoice</p>
                <p className="text-white text-lg font-bold font-mono">#{invoice.invoiceId}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {formatDateTime(invoice.createdAt).date} · {formatDateTime(invoice.createdAt).time}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] mb-0.5">Amount</p>
                <p className="text-white text-xl font-bold">৳{final.toLocaleString()}</p>
                {due === 0 ? (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-green-500/20 text-green-300 border border-green-500/30 text-[10px] font-semibold">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Fully Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-semibold">
                    <Wallet className="w-2.5 h-2.5" /> Due ৳{due.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-sm font-semibold text-gray-900">{invoice.patient?.name}</span>
                <span className="text-xs text-gray-400 capitalize">
                  · {invoice.patient?.gender} · {invoice.patient?.age}y
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">{invoice.patient?.contactNumber}</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 flex flex-wrap gap-2">
            {onlineTests.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-medium text-indigo-700">
                <FlaskConical className="w-3 h-3" />
                {onlineTests.length} online test{onlineTests.length !== 1 ? "s" : ""}
              </span>
            )}
            {offlineTests.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600">
                <FileText className="w-3 h-3" />
                {offlineTests.length} offline test{offlineTests.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="px-5 pb-4">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                This invoice will be <span className="font-semibold">removed from all active lists</span>. You can view
                it in the Deleted History tab.
              </p>
            </div>
            <button
              onClick={() => setConfirmPopup(true)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete Invoice #{invoice.invoiceId}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Deleted Invoice Row ──────────────────────────────────────────────────────

const DeletedInvoiceRow = ({ invoice, index }) => {
  const createdDt = formatDateTime(invoice.createdAt);
  const deletedDt = formatDateTime(invoice.deletion?.at);
  const deletedBy = invoice.deletion?.by?.name ?? null;
  const final = invoice.amount?.final ?? 0;
  const due = getDue(invoice);
  const onlineTests = invoice.tests?.filter((t) => t.schemaId) ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-50">
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-red-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{invoice.patient?.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            #{invoice.invoiceId} · Created {createdDt.date}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-400 bg-red-50 border border-red-100 rounded-lg shrink-0">
          <Trash2 className="w-3 h-3" /> Deleted
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 border-t border-gray-50">
        <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium">
          <History className="w-3 h-3" />
          {deletedDt.date} · {deletedDt.time}
        </span>
        {deletedBy && (
          <>
            <span className="w-px h-3 bg-gray-200 hidden sm:block" />
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <User className="w-3 h-3" />
              {deletedBy}
            </span>
          </>
        )}
        <span className="w-px h-3 bg-gray-200 hidden sm:block" />
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <User className="w-3 h-3" />
          {invoice.patient?.gender} · {invoice.patient?.age}y
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <Phone className="w-3 h-3" />
          {invoice.patient?.contactNumber}
        </span>
        <span className="w-px h-3 bg-gray-200 hidden sm:block" />
        <span className="text-[11px] font-semibold text-gray-600">
          ৳{final.toLocaleString()}
          {due > 0 && <span className="text-red-400 font-normal"> · Due ৳{due.toLocaleString()}</span>}
        </span>
        {onlineTests.length > 0 && (
          <>
            <span className="w-px h-3 bg-gray-200 hidden sm:block" />
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <FlaskConical className="w-3 h-3" />
              {onlineTests.length} online test{onlineTests.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  </div>
);

// ─── Deleted Invoices List ────────────────────────────────────────────────────

const DeletedInvoicesList = ({ refreshTrigger, onLoadingChange, onError, onNetworkError }) => {
  const [invoices, setInvoices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [timeRange, setTimeRange] = useState(null);

  const loadInvoices = async (cursor = null, replace = true, range = timeRange) => {
    try {
      replace ? setInitialLoading(true) : (setLoadingMore(true), onLoadingChange("Loading more..."));
      const { data } = await invoiceService.getDeletedInvoices({
        cursor,
        limit: 20,
        ...(range && { startDate: range.start, endDate: range.end }),
      });
      setInvoices((prev) => (replace ? data.invoices : [...prev, ...data.invoices]));
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError();
      } else {
        onError(getErrorMessage(err, "Could not load deleted invoices."));
      }
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
      onLoadingChange(null);
    }
  };

  useEffect(() => {
    const now = new Date();
    const initial = { start: new Date(now).setHours(0, 0, 0, 0), end: new Date(now).setHours(23, 59, 59, 999) };
    setTimeRange(initial);
    loadInvoices(null, true, initial);
  }, []);

  useEffect(() => {
    if (refreshTrigger === 0) return;
    loadInvoices(null, true, timeRange);
  }, [refreshTrigger]); // eslint-disable-line

  const handleFetchData = (start, end) => {
    const range = { start, end };
    setTimeRange(range);
    loadInvoices(null, true, range);
  };

  return (
    <div className="space-y-4">
      <TimeFrame onFetchData={handleFetchData} />

      {!initialLoading && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 shadow-sm">
            <PackageSearch className="w-3.5 h-3.5 text-red-400" />
            {invoices.length} deleted invoice{invoices.length !== 1 ? "s" : ""} loaded
            {hasMore && <span className="text-gray-400 font-normal ml-1">· more available</span>}
          </span>
        </div>
      )}

      {initialLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="bg-red-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-7 h-7 text-red-300" />
          </div>
          <p className="text-sm font-semibold text-gray-800">No deleted invoices</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            No invoices were deleted in the selected time period.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice, index) => (
            <DeletedInvoiceRow key={invoice._id} invoice={invoice} index={index} />
          ))}
          {hasMore && (
            <div className="flex items-center gap-3 pt-2 pb-1">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-red-100" />
              <button
                onClick={() => loadInvoices(nextCursor, false)}
                disabled={loadingMore}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-red-200 hover:border-red-400 hover:bg-red-50 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronDown className="w-3.5 h-3.5 text-red-400 group-hover:translate-y-0.5 transition-transform duration-200" />
                <span className="text-xs font-semibold text-red-500">Load more</span>
                <span className="text-[10px] font-medium text-red-400 bg-red-50 group-hover:bg-white border border-red-100 px-1.5 py-0.5 rounded-full transition-colors">
                  +20
                </span>
              </button>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-red-100" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "delete", label: "Delete Invoice", Icon: Trash2 },
  { key: "history", label: "Deleted History", Icon: History },
];

const DeleteInvoices = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isAdmin = user?.role === "admin";
  const hasAccess = isAdmin || user?.permissions?.deleteInvoice === true;
  if (!hasAccess) {
    return <Popup type="denied" message="ইনভয়েস ডিলিট করার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }

  const [activeTab, setActiveTab] = useState("delete");
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [popup, setPopup] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDeleted = (invoiceId) => {
    setPopup({ type: "success", message: `Invoice #${invoiceId} has been deleted.` });
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-6">
      {loadingMessage && <LoadingScreen message={loadingMessage} />}
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {networkError && <Popup type="offline" onClose={() => setNetworkError(false)} />}

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-7 h-7 text-red-500" /> Delete Invoices
            </h1>
            <p className="text-sm text-gray-500 mt-1">Soft delete — data is preserved in history</p>
          </div>
          <Link
            to="/outdoor"
            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 text-sm font-medium shadow-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 mb-5 flex gap-1">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === key
                  ? key === "delete"
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-slate-700 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "delete" && (
          <DeleteInvoicePanel
            onDeleted={handleDeleted}
            onLoadingChange={setLoadingMessage}
            onError={(msg) => setPopup({ type: "error", message: msg })}
            onNetworkError={() => setNetworkError(true)}
          />
        )}
        {activeTab === "history" && (
          <DeletedInvoicesList
            refreshTrigger={refreshTrigger}
            onLoadingChange={setLoadingMessage}
            onError={(msg) => setPopup({ type: "error", message: msg })}
            onNetworkError={() => setNetworkError(true)}
          />
        )}
      </div>
    </section>
  );
};

export default DeleteInvoices;
