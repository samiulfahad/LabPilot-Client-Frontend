/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Modal from "../../../components/modal";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pill,
  FlaskConical,
  BarChart3,
  Banknote,
  AlertCircle,
  Grid3X3,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  Lock,
  ArrowLeft,
} from "lucide-react";
import Popup from "../../../components/popup";
import productService from "../../../api/products";
import { useAuthStore } from "../../../store/authStore";

// ── Palette ────────────────────────────────────────────────────────────────────

const C = {
  ink: "#0F172A",
  muted: "#94A3B8",
  sub: "#64748B",
  border: "#E2E8F0",
  paper: "#F8FAFC",
  hover: "#F1F5F9",
  divider: "#EEF2FF",
  teal: "#0D9488",
  indigo: "#6366F1",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  green: "#10B981",
  blue: "#3B82F6",
  emerald: "#10B981",
};

// Page background — matches ManageDoctors.jsx / ManageTests.jsx / Setup.jsx / ManageReferrer.jsx / ManageStaff.jsx
const pageGradientBg = "bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#eef2ff_0%,#f8fafc_45%,#f8fafc_100%)]";

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 50;
const DEBOUNCE_MS = 400;

const ITEM_TYPES = {
  medicine: {
    key: "medicine",
    label: "Medicine",
    bangla: "ওষুধ",
    plural: "Medicines",
    icon: Pill,
    accent: C.emerald,
    grad: "linear-gradient(135deg,#10B981,#059669)",
    softBg: "#10B98110",
    softBorder: "#10B98125",
    desc: "ওষুধ ও সরবরাহ",
    hasStock: true,
  },
  product: {
    key: "product",
    label: "Product",
    bangla: "পণ্য",
    plural: "Products",
    icon: Package,
    accent: C.blue,
    grad: "linear-gradient(135deg,#3B82F6,#2563EB)",
    softBg: "#3B82F610",
    softBorder: "#3B82F625",
    desc: "ল্যাব কিট ও সরঞ্জাম",
    hasStock: true,
  },
  service: {
    key: "service",
    label: "Service",
    bangla: "সেবা",
    plural: "Services",
    icon: FlaskConical,
    accent: C.purple,
    grad: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
    softBg: "#8B5CF610",
    softBorder: "#8B5CF625",
    desc: "পরীক্ষা ও পরামর্শ ফি",
    hasStock: false,
  },
};

const MED_UNIT_TYPES = [
  { value: "stripe", label: "Stripe", qtyLabel: "Tabs / stripe", placeholder: "10" },
  { value: "bottle", label: "Bottle", qtyLabel: "ml / bottle", placeholder: "100" },
  { value: "vial", label: "Vial", qtyLabel: "ml / vial", placeholder: "5" },
  { value: "sachet", label: "Sachet", qtyLabel: "g / sachet", placeholder: "5" },
  { value: "piece", label: "Piece", qtyLabel: null, placeholder: null },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatPrice = (p) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(p);

const stockBadge = (stock) => {
  if (stock === 0) return { label: "স্টক নেই", color: C.red, bg: "#EF444410", border: "#EF444430" };
  if (stock <= 5) return { label: "কম স্টক", color: C.amber, bg: "#F59E0B10", border: "#F59E0B30" };
  return { label: "স্টক আছে", color: C.green, bg: "#10B98110", border: "#10B98130" };
};

// ── Error helpers ──────────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";

const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return err?.response?.data?.error ?? PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

const getErrorStatus = (error) => error?.response?.status ?? error?.status ?? null;

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ── Shared input helpers ───────────────────────────────────────────────────────

const inputBase =
  "w-full outline-none transition-all rounded-xl border-[1.5px] border-[#E2E8F0] bg-white text-[#0F172A] font-['IBM_Plex_Mono',monospace]";

const focusInput = (e) => {
  e.target.style.borderColor = "#0D9488";
  e.target.style.boxShadow = "0 0 0 3px #0D948820";
};
const blurInput = (e) => {
  e.target.style.borderColor = "#E2E8F0";
  e.target.style.boxShadow = "";
};

// ── Stock Modal ────────────────────────────────────────────────────────────────

const StockModal = ({ item, onClose, onSave, onNetworkError }) => {
  const [delta, setDelta] = useState(1);
  const [mode, setMode] = useState("add");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const currentStock = item.stock ?? 0;
  const effectiveDelta = mode === "add" ? Math.abs(delta) : -Math.abs(delta);
  const preview = currentStock + effectiveDelta;

  const handleSubmit = async () => {
    if (!delta || Number(delta) === 0) return;
    if (preview < 0) {
      setApiError("স্টক শূন্যের নিচে যেতে পারবে না।");
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      await productService.adjustStock(item._id, effectiveDelta, note.trim() || undefined);
      onSave();
    } catch (err) {
      if (isNetworkError(err)) {
        setApiError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        onNetworkError?.();
      } else {
        setApiError(getErrorMessage(err, "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen size="sm" onClose={onClose}>
      <div className="flex flex-col max-h-[calc(100svh-96px)] overflow-hidden">
        {/* Header — fixed, never scrolls */}
        <div
          className="shrink-0 px-6 py-5 flex items-center justify-between border-b border-[#0D948820]"
          style={{ background: "linear-gradient(135deg,#0D948815 0%,#0F766E08 100%)" }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0 w-11 h-11 rounded-[14px] shadow-[0_8px_20px_#0D948840]"
              style={{ background: "linear-gradient(135deg,#0D9488,#0F766E)" }}
            >
              <BarChart3 className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px] text-[#0D9488]">
                স্টক সামঞ্জস্য
              </p>
              <p className="font-['IBM_Plex_Sans',sans-serif] text-base font-bold text-[#0F172A] truncate max-w-[280px]">
                {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-[10px] text-[#94A3B8] border-[1.5px] border-[#E2E8F0] transition-all hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        {/* Body — the ONLY scrollable region, fills remaining space */}
        <div className="px-6 py-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {/* Current stock */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#64748B]">বর্তমান স্টক</span>
            <span className="font-['IBM_Plex_Mono',monospace] text-sm font-bold text-[#0F172A] tabular-nums">
              {currentStock} ইউনিট
            </span>
          </div>

          {/* Add / Remove toggle */}
          <div className="flex rounded-xl border-[1.5px] border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => setMode("add")}
              className="flex-1 py-2.5 font-['IBM_Plex_Mono',monospace] text-xs font-bold transition-all"
              style={
                mode === "add"
                  ? { background: "linear-gradient(135deg,#10B981,#059669)", color: "white" }
                  : { background: "white", color: C.sub }
              }
            >
              + যোগ
            </button>
            <button
              onClick={() => setMode("remove")}
              className="flex-1 py-2.5 font-['IBM_Plex_Mono',monospace] text-xs font-bold transition-all"
              style={
                mode === "remove"
                  ? { background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "white" }
                  : { background: "white", color: C.sub }
              }
            >
              − কমান
            </button>
          </div>

          {/* Delta input */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDelta((d) => Math.max(1, Number(d) - 1))}
              className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              value={delta}
              min={1}
              onChange={(e) => setDelta(e.target.value)}
              className={`${inputBase} py-2 text-center text-sm font-bold`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <button
              type="button"
              onClick={() => setDelta((d) => Number(d) + 1)}
              className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="নোট (ঐচ্ছিক)…"
            maxLength={200}
            className={`${inputBase} px-3 py-2 text-xs`}
            onFocus={focusInput}
            onBlur={blurInput}
          />

          {/* Preview */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#64748B]">নতুন স্টক</span>
            <span
              className="font-['IBM_Plex_Mono',monospace] text-sm font-bold tabular-nums"
              style={{ color: preview < 0 ? C.red : C.ink }}
            >
              {preview} ইউনিট
            </span>
          </div>
        </div>

        {/* Footer — fixed, never scrolls */}
        <div className="shrink-0 border-t border-[#E2E8F0] bg-white">
          {apiError && (
            <div className="mx-6 mt-4 flex items-start gap-2.5 px-4 py-3 bg-[#EF444408] border-[1.5px] border-[#EF444430] rounded-xl">
              <AlertTriangle className="w-[14px] h-[14px] text-[#EF4444] shrink-0 mt-[1px]" />
              <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#EF4444]">{apiError}</span>
            </div>
          )}
          <div className="px-6 py-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 font-semibold transition-all rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] font-['IBM_Plex_Mono',monospace] text-xs bg-white hover:bg-[#F1F5F9]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || preview < 0}
              className="flex-1 py-3 flex items-center justify-center gap-2 font-semibold transition-all rounded-xl border-none text-white font-['IBM_Plex_Mono',monospace] text-xs"
              style={{
                background: loading || preview < 0 ? C.muted : "linear-gradient(135deg,#0D9488,#0F766E)",
                boxShadow: loading || preview < 0 ? "none" : "0 4px 14px rgba(13,148,136,0.4)",
              }}
            >
              {loading ? (
                <span className="animate-spin inline-block w-[14px] h-[14px] rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckCircle2 className="w-[13px] h-[13px]" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Price Modal ────────────────────────────────────────────────────────────────

const PriceModal = ({ item, onClose, onSave, onNetworkError }) => {
  const [price, setPrice] = useState(String(item.price ?? ""));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const invalid = price === "" || isNaN(price) || Number(price) < 0;

  const handleSubmit = async () => {
    if (invalid) return;
    setSaving(true);
    setApiError("");
    try {
      await productService.updateProductPrice(item._id, parseFloat(price));
      onSave();
    } catch (err) {
      if (isNetworkError(err)) {
        setApiError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        onNetworkError?.();
      } else if (getErrorStatus(err) === 404) {
        setApiError("আইটেমটি আর পাওয়া যায়নি।");
      } else {
        setApiError(getErrorMessage(err, "মূল্য সংরক্ষণ ব্যর্থ।"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen size="sm" onClose={onClose}>
      <div className="flex flex-col max-h-[calc(100svh-96px)] overflow-hidden">
        {/* Header — fixed, never scrolls */}
        <div
          className="shrink-0 px-6 py-5 flex items-center justify-between border-b border-[#3B82F620]"
          style={{ background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)" }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0 w-11 h-11 rounded-[14px] shadow-[0_8px_20px_rgba(59,130,246,0.35)]"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              <Banknote className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px] text-[#2563EB]">
                মূল্য পরিবর্তন
              </p>
              <p className="font-['IBM_Plex_Sans',sans-serif] text-base font-bold text-[#0F172A] truncate max-w-[280px]">
                {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-[10px] text-[#94A3B8] border-[1.5px] border-[#E2E8F0] bg-white transition-all hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        {/* Body — the ONLY scrollable region, fills remaining space */}
        <div className="px-6 py-5 bg-[#F8FAFC] flex-1 min-h-0 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-2">
              মূল্য
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-['IBM_Plex_Mono',monospace] text-xs font-bold text-[#0D9488]">
                ৳
              </span>
              <input
                type="number"
                autoFocus
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (apiError) setApiError("");
                }}
                placeholder="০.০০"
                min="0"
                className={`${inputBase} pl-7 pr-3 py-2.5 text-sm`}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
          </div>
        </div>

        {/* Footer — fixed, never scrolls */}
        <div className="shrink-0 bg-white border-t border-[#E2E8F0]">
          {apiError && (
            <div className="mx-6 mt-4 flex items-start gap-2.5 px-4 py-3 bg-[#EF444408] border-[1.5px] border-[#EF444430] rounded-xl">
              <AlertTriangle className="w-[14px] h-[14px] text-[#EF4444] shrink-0 mt-[1px]" />
              <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#EF4444]">{apiError}</span>
            </div>
          )}
          <div className="px-6 py-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 font-semibold transition-all rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] font-['IBM_Plex_Mono',monospace] text-xs hover:bg-[#F1F5F9]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || invalid}
              className="flex-1 py-3 flex items-center justify-center gap-2 font-semibold transition-all rounded-xl border-none text-white font-['IBM_Plex_Mono',monospace] text-xs disabled:opacity-60"
              style={{ background: saving ? "#94A3B8" : "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              {saving ? (
                <span className="animate-spin inline-block w-[14px] h-[14px] rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Banknote className="w-[13px] h-[13px]" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Info Modal (Edit) ─────────────────────────────────────────────────────────

const InfoModal = ({ item, onClose, onSave, onNetworkError }) => {
  const typeDef = ITEM_TYPES[item.type] ?? ITEM_TYPES.product;
  const TypeIcon = typeDef.icon;

  const [form, setForm] = useState({
    name: item.name ?? "",
    description: item.description ?? "",
    hasStock: item.hasStock ?? false,
    unitType: item.unitType ?? "stripe",
    unitQty: item.unitQty ?? "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "প্রয়োজনীয়";
    else if (form.name.length > 100) e.name = "সর্বোচ্চ ১০০ অক্ষর";
    if (form.description.length > 500) e.description = "সর্বোচ্চ ৫০০ অক্ষর";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const activeUnitDef = MED_UNIT_TYPES.find((u) => u.value === form.unitType);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        ...(typeDef.hasStock && { hasStock: form.hasStock }),
        ...(item.type === "medicine" && { unitType: form.unitType }),
        ...(item.type === "medicine" &&
          activeUnitDef?.qtyLabel &&
          form.unitQty !== "" && { unitQty: Number(form.unitQty) }),
      };
      await productService.updateProductInfo(item._id, payload);
      onSave();
    } catch (err) {
      if (isNetworkError(err)) {
        setApiError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        onNetworkError?.();
      } else {
        setApiError(getErrorMessage(err, "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen size="md" onClose={onClose}>
      <div className="flex flex-col max-h-[calc(100svh-96px)] overflow-hidden">
        {/* Header — fixed, never scrolls */}
        <div
          className="shrink-0 px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: `linear-gradient(135deg,${typeDef.softBg} 0%,transparent 100%)`,
            borderColor: typeDef.softBorder,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0 w-11 h-11 rounded-[14px]"
              style={{ background: typeDef.grad, boxShadow: `0 8px 20px ${typeDef.accent}40` }}
            >
              <TypeIcon className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p
                className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px]"
                style={{ color: typeDef.accent }}
              >
                তথ্য সম্পাদনা
              </p>
              <p className="font-['IBM_Plex_Sans',sans-serif] text-base font-bold text-[#0F172A]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-[10px] text-[#94A3B8] border-[1.5px] border-[#E2E8F0] transition-all hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        {/* Body — the ONLY scrollable region, fills remaining space */}
        <div className="px-6 py-5 bg-[#F8FAFC] space-y-4 flex-1 min-h-0 overflow-y-auto">
          {/* Name */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-2">
              নাম
            </p>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={`${inputBase} px-3 py-2 text-sm ${errors.name ? "border-[#EF444460]" : ""}`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errors.name && (
              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.name}</p>
            )}
          </div>

          {/* Medicine unit */}
          {item.type === "medicine" && (
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-3">
                ইউনিট ধরন
              </p>
              <div className="flex flex-wrap gap-2">
                {MED_UNIT_TYPES.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => set("unitType", u.value)}
                    className="px-3 py-1.5 font-['IBM_Plex_Mono',monospace] text-xs font-bold rounded-lg border-[1.5px] transition-all"
                    style={
                      form.unitType === u.value
                        ? {
                            background: typeDef.grad,
                            color: "white",
                            borderColor: "transparent",
                            boxShadow: `0 4px 10px ${typeDef.accent}30`,
                          }
                        : { background: "white", color: C.sub, borderColor: C.border }
                    }
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.qtyLabel && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    value={form.unitQty}
                    min={1}
                    onChange={(e) => set("unitQty", e.target.value)}
                    placeholder={MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.placeholder}
                    className={`${inputBase} w-24 px-3 py-2 text-xs`}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#64748B]">
                    {MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.qtyLabel}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Stock tracking toggle */}
          {typeDef.hasStock && (
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                    স্টক ট্র্যাকিং
                  </p>
                  {!item.hasStock && form.hasStock && (
                    <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#94A3B8] mt-1">
                      চালু করলে স্টক ০ থেকে শুরু হবে — এরপর Stock বাটন দিয়ে সমন্বয় করুন।
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => set("hasStock", !form.hasStock)}
                  className="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                  style={{ background: form.hasStock ? C.teal : C.muted }}
                >
                  <span
                    className="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform"
                    style={{ transform: form.hasStock ? "translateX(12px)" : "translateX(0)" }}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                নোট
              </p>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#94A3B8]">
                {form.description.length}/500
              </span>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="সংক্ষিপ্ত বিবরণ… (ঐচ্ছিক)"
              rows={2}
              className={`${inputBase} px-3 py-2 text-xs resize-none`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errors.description && (
              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Footer — fixed, never scrolls */}
        <div className="shrink-0 border-t border-[#E2E8F0] bg-white">
          {apiError && (
            <div className="mx-6 mt-4 flex items-start gap-2.5 px-4 py-3 bg-[#EF444408] border-[1.5px] border-[#EF444430] rounded-xl">
              <AlertTriangle className="w-[14px] h-[14px] text-[#EF4444] shrink-0 mt-[1px]" />
              <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#EF4444]">{apiError}</span>
            </div>
          )}
          <div className="px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 font-semibold transition-all rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] font-['IBM_Plex_Mono',monospace] text-xs bg-white hover:bg-[#F1F5F9]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 font-semibold transition-all rounded-xl border-none text-white font-['IBM_Plex_Mono',monospace] text-xs"
              style={{
                background: loading ? C.muted : typeDef.grad,
                boxShadow: loading ? "none" : `0 4px 14px ${typeDef.accent}40`,
              }}
            >
              {loading ? (
                <span className="animate-spin inline-block w-[14px] h-[14px] rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckCircle2 className="w-[13px] h-[13px]" />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Create Modal ───────────────────────────────────────────────────────────────

const CreateItemModal = ({ activeType, onClose, onSave, onNetworkError }) => {
  const typeDef = ITEM_TYPES[activeType];
  const TypeIcon = typeDef.icon;

  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    hasStock: false,
    stock: 0,
    unitType: "stripe",
    unitQty: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "প্রয়োজনীয়";
    else if (form.name.length > 100) e.name = "সর্বোচ্চ ১০০ অক্ষর";
    if (form.price === "" || form.price === null) e.price = "প্রয়োজনীয়";
    else if (isNaN(form.price) || Number(form.price) < 0) e.price = "০ বা তার বেশি হতে হবে";
    if (form.description.length > 500) e.description = "সর্বোচ্চ ৫০০ অক্ষর";
    if (typeDef.hasStock && form.hasStock && (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0))
      e.stock = "০ বা তার বেশি হতে হবে";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setApiError("");
    try {
      const activeUnitDef = MED_UNIT_TYPES.find((u) => u.value === form.unitType);
      const payload = {
        type: activeType,
        name: form.name.trim(),
        price: Number(form.price),
        description: form.description.trim() || undefined,
        ...(typeDef.hasStock && { hasStock: form.hasStock }),
        ...(typeDef.hasStock && form.hasStock && { stock: Number(form.stock) }),
        ...(activeType === "medicine" && { unitType: form.unitType }),
        ...(activeType === "medicine" &&
          activeUnitDef?.qtyLabel &&
          form.unitQty !== "" && { unitQty: Number(form.unitQty) }),
      };
      await productService.createProduct(payload);
      onSave();
    } catch (err) {
      if (isNetworkError(err)) {
        setApiError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        onNetworkError?.();
      } else {
        setApiError(getErrorMessage(err, "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen size="md" onClose={onClose}>
      <div className="flex flex-col max-h-[calc(100svh-96px)] overflow-hidden">
        {/* Header — fixed, never scrolls */}
        <div
          className="shrink-0 px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: `linear-gradient(135deg,${typeDef.softBg} 0%,transparent 100%)`,
            borderColor: typeDef.softBorder,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex items-center justify-center shrink-0 w-11 h-11 rounded-[14px]"
              style={{ background: typeDef.grad, boxShadow: `0 8px 20px ${typeDef.accent}40` }}
            >
              <TypeIcon className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <p
                className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px]"
                style={{ color: typeDef.accent }}
              >
                নতুন আইটেম
              </p>
              <p className="font-['IBM_Plex_Sans',sans-serif] text-base font-bold text-[#0F172A]">
                নতুন {typeDef.bangla}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-[10px] text-[#94A3B8] border-[1.5px] border-[#E2E8F0] transition-all hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="w-[15px] h-[15px]" />
          </button>
        </div>

        {/* Body — the ONLY scrollable region, fills remaining space */}
        <div className="px-6 py-5 bg-[#F8FAFC] space-y-4 flex-1 min-h-0 overflow-y-auto">
          {/* Name */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-2">
              নাম
            </p>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={
                activeType === "medicine"
                  ? "যেমন: Napa Tablet 500mg"
                  : activeType === "product"
                    ? "যেমন: Blood Culture Kit"
                    : "যেমন: CBC Panel"
              }
              className={`${inputBase} px-3 py-2 text-sm ${errors.name ? "border-[#EF444460]" : ""}`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errors.name && (
              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.name}</p>
            )}
          </div>

          {/* Medicine unit */}
          {activeType === "medicine" && (
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-3">
                ইউনিট ধরন
              </p>
              <div className="flex flex-wrap gap-2">
                {MED_UNIT_TYPES.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => set("unitType", u.value)}
                    className="px-3 py-1.5 font-['IBM_Plex_Mono',monospace] text-xs font-bold rounded-lg border-[1.5px] transition-all"
                    style={
                      form.unitType === u.value
                        ? {
                            background: typeDef.grad,
                            color: "white",
                            borderColor: "transparent",
                            boxShadow: `0 4px 10px ${typeDef.accent}30`,
                          }
                        : { background: "white", color: C.sub, borderColor: C.border }
                    }
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.qtyLabel && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    value={form.unitQty}
                    min={1}
                    onChange={(e) => set("unitQty", e.target.value)}
                    placeholder={MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.placeholder}
                    className={`${inputBase} w-24 px-3 py-2 text-xs`}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#64748B]">
                    {MED_UNIT_TYPES.find((u) => u.value === form.unitType)?.qtyLabel}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Price */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-2">
              মূল্য
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-['IBM_Plex_Mono',monospace] text-xs font-bold text-[#0D9488]">
                ৳
              </span>
              <input
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="০.০০"
                min="0"
                className={`${inputBase} pl-7 pr-3 py-2 text-sm ${errors.price ? "border-[#EF444460]" : ""}`}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>
            {errors.price && (
              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.price}</p>
            )}
          </div>

          {/* Stock */}
          {typeDef.hasStock ? (
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                  প্রারম্ভিক স্টক
                </p>
                <button
                  type="button"
                  onClick={() => set("hasStock", !form.hasStock)}
                  className="relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                  style={{ background: form.hasStock ? C.teal : C.muted }}
                >
                  <span
                    className="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform"
                    style={{ transform: form.hasStock ? "translateX(12px)" : "translateX(0)" }}
                  />
                </button>
              </div>
              {form.hasStock ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set("stock", Math.max(0, Number(form.stock) - 1))}
                    className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={form.stock}
                    min={0}
                    onChange={(e) => set("stock", e.target.value)}
                    className={`${inputBase} py-2 text-center text-sm font-bold ${errors.stock ? "border-[#EF444460]" : ""}`}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <button
                    type="button"
                    onClick={() => set("stock", Number(form.stock) + 1)}
                    className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center h-9 px-3 rounded-xl border-[1.5px] border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#94A3B8]">ট্র্যাক করা হচ্ছে না</span>
                </div>
              )}
              {errors.stock && (
                <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.stock}</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
              <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] mb-2">
                স্টক
              </p>
              <div className="flex items-center h-9 px-3 rounded-xl border-[1.5px] border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#94A3B8]">
                  সেবার জন্য স্টক প্রযোজ্য নয়
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
                নোট
              </p>
              <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#94A3B8]">
                {form.description.length}/500
              </span>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="সংক্ষিপ্ত বিবরণ… (ঐচ্ছিক)"
              rows={2}
              className={`${inputBase} px-3 py-2 text-xs resize-none`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errors.description && (
              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#EF4444] mt-1.5">{errors.description}</p>
            )}
          </div>
        </div>

        {/* Footer — fixed, never scrolls */}
        <div className="shrink-0 border-t border-[#E2E8F0] bg-white">
          {apiError && (
            <div className="mx-6 mt-4 flex items-start gap-2.5 px-4 py-3 bg-[#EF444408] border-[1.5px] border-[#EF444430] rounded-xl">
              <AlertTriangle className="w-[14px] h-[14px] text-[#EF4444] shrink-0 mt-[1px]" />
              <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#EF4444]">{apiError}</span>
            </div>
          )}
          <div className="px-6 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 font-semibold transition-all rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] font-['IBM_Plex_Mono',monospace] text-xs bg-white hover:bg-[#F1F5F9]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 font-semibold transition-all rounded-xl border-none text-white font-['IBM_Plex_Mono',monospace] text-xs"
              style={{
                background: loading ? C.muted : typeDef.grad,
                boxShadow: loading ? "none" : `0 4px 14px ${typeDef.accent}40`,
              }}
            >
              {loading ? (
                <span className="animate-spin inline-block w-[14px] h-[14px] rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckCircle2 className="w-[13px] h-[13px]" />
              )}
              Create
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Stat Card ──────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, grad, icon: Icon }) => (
  <div className="bg-white relative overflow-hidden border border-[#E2E8F0] rounded-2xl p-[14px_16px] shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
    <div className="absolute top-0 right-0 w-16 h-16 opacity-5 rounded-[0_16px_0_100%]" style={{ background: grad }} />
    <div className="flex items-center gap-2 mb-2">
      <div
        className="flex items-center justify-center w-[26px] h-[26px] rounded-lg"
        style={{ background: grad, boxShadow: `0 3px 8px ${color}30` }}
      >
        <Icon className="w-[13px] h-[13px] text-white" />
      </div>
      <p className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">
        {label}
      </p>
    </div>
    <p className="font-['IBM_Plex_Mono',monospace] text-[26px] font-extrabold leading-none" style={{ color }}>
      {value}
    </p>
  </div>
);

// ── Avatar-style icon chip — mirrors Avatar in ManageDoctors / ManageTests ──────

const ItemIconChip = ({ icon: Icon, accent, softBg }) => (
  <div className="w-10 h-10 flex items-center justify-center shrink-0 rounded-[9px]" style={{ background: softBg }}>
    <Icon className="w-[16px] h-[16px]" style={{ color: accent }} />
  </div>
);

// ── Skeleton — mirrors ManageDoctors.jsx / ManageTests.jsx card-list skeleton ───

const Skeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-4 py-3.5 bg-white border border-[#E2E8F0] rounded-[14px] animate-pulse"
      >
        <div className="w-10 h-10 bg-[#E2E8F0] rounded-[9px] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/5 bg-[#E2E8F0] rounded-md" />
          <div className="h-2.5 w-3/5 bg-[#EEF2FF] rounded-md" />
        </div>
        <div className="w-[65px] h-[26px] bg-[#E2E8F0] rounded-[20px]" />
      </div>
    ))}
  </div>
);

// ── Item Card — card style, mirrors DoctorRow in ManageDoctors.jsx ─────────────

const ItemCard = ({ item, onEditInfo, onEditPrice, onDelete, onAdjustStock }) => {
  const [expanded, setExpanded] = useState(false);
  const typeDef = ITEM_TYPES[item.type] ?? ITEM_TYPES.product;
  const stock = item.stock ?? 0;
  const badge = stockBadge(stock);

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-[14px] transition-shadow"
      style={{ boxShadow: expanded ? "0 4px 14px rgba(15,23,42,0.08)" : "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <ItemIconChip icon={typeDef.icon} accent={typeDef.accent} softBg={typeDef.softBg} />

          <div className="flex-1 min-w-0">
            <span className="font-['IBM_Plex_Sans',sans-serif] text-sm font-semibold text-[#0F172A] truncate block">
              {item.name}
            </span>
            <p className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#94A3B8] mt-0.5 truncate">
              ৳{(item.price ?? 0).toLocaleString("en-IN")}
              {item.type === "medicine" && item.unitType ? ` · ${item.unitType}` : ""}
            </p>
          </div>

          {item.hasStock && (
            <span
              className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-[20px] font-['IBM_Plex_Mono',monospace] text-[10px] font-bold border-[1.5px]"
              style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
            >
              {stock} ইউনিট
            </span>
          )}

          <ChevronDown
            className={`w-[15px] h-[15px] text-[#94A3B8] transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#E2E8F0]">
          <div className="pt-3.5 space-y-3.5">
            <div className="font-['IBM_Plex_Mono',monospace] text-xs text-[#64748B] leading-loose flex flex-wrap gap-x-4 gap-y-1">
              <span>
                মূল্য: <span className="font-bold text-[#0D9488]">৳{(item.price ?? 0).toLocaleString("en-IN")}</span>
              </span>
              {item.type === "medicine" && item.unitType && (
                <span>
                  ইউনিট:{" "}
                  <span className="font-bold text-[#0F172A]">
                    {item.unitType}
                    {item.unitQty ? ` (${item.unitQty})` : ""}
                  </span>
                </span>
              )}
              {item.hasStock && (
                <span>
                  স্টক:{" "}
                  <span className="font-bold" style={{ color: badge.color }}>
                    {stock} ইউনিট · {badge.label}
                  </span>
                </span>
              )}
              {item.description && <span className="w-full text-[#94A3B8] truncate">{item.description}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ActionChip onClick={() => onEditInfo(item)} icon={Pencil} label="Edit" color={C.blue} />
              <ActionChip onClick={() => onEditPrice(item)} icon={Banknote} label="Price" color={C.teal} />
              {item.hasStock && (
                <ActionChip onClick={() => onAdjustStock(item)} icon={BarChart3} label="Stock" color={C.purple} />
              )}
              <ActionChip onClick={() => onDelete(item)} icon={Trash2} label="Delete" color={C.red} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Action Chip ────────────────────────────────────────────────────────────────

const ActionChip = ({ onClick, icon: Icon, label, color }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 transition-all font-semibold px-3 py-[5px] rounded-lg font-['IBM_Plex_Mono',monospace] text-[11px]"
    style={{ border: `1.5px solid ${color}25`, color, background: `${color}08` }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = `${color}18`;
      e.currentTarget.style.borderColor = `${color}50`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = `${color}08`;
      e.currentTarget.style.borderColor = `${color}25`;
    }}
  >
    <Icon className="w-[11px] h-[11px]" />
    {label}
  </button>
);

// ── Section Divider ────────────────────────────────────────────────────────────

const SectionDivider = ({ title, count, color }) => (
  <div className="flex items-center gap-2 pt-1 pb-1">
    <span
      className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold uppercase tracking-[0.1em]"
      style={{ color }}
    >
      {title}
    </span>
    <span
      className="font-['IBM_Plex_Mono',monospace] text-[10px] font-bold px-1.5 py-px rounded-[5px]"
      style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}
    >
      {count}
    </span>
    <div className="flex-1 h-px" style={{ background: `${color}20` }} />
  </div>
);

// ── Filter Dropdown ────────────────────────────────────────────────────────────

const FilterDropdown = ({ value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none outline-none cursor-pointer transition-all font-['IBM_Plex_Mono',monospace] text-xs rounded-[10px] py-[7px] pl-3 pr-[30px] border-[1.5px]
        ${value !== "all" ? "border-[#0D948860] bg-[#0D948808] text-[#0F172A] shadow-[0_2px_8px_#0D948815]" : "border-[#E2E8F0] bg-white text-[#64748B]"}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="w-3 h-3 text-[#94A3B8] absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

// ── Pagination — mirrors Pagination in ManageDoctors.jsx ────────────────────────

const Pagination = ({ pagination, onPageChange }) => {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;
  const delta = 1;
  const start = Math.max(1, page - delta);
  const end = Math.min(totalPages, page + delta);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const Btn = ({ onClick, disabled, active, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center transition-all w-8 h-8 rounded-[10px] font-['IBM_Plex_Mono',monospace] text-xs font-bold"
      style={{
        background: active ? "linear-gradient(135deg,#6366F1,#4F46E5)" : "white",
        border: `1.5px solid ${active ? "transparent" : C.border}`,
        color: active ? "white" : disabled ? C.muted : C.sub,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: active ? "0 4px 10px rgba(99,102,241,0.35)" : undefined,
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Btn onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        <ChevronLeft className="w-[14px] h-[14px]" />
      </Btn>
      {start > 1 && (
        <>
          <Btn onClick={() => onPageChange(1)}>1</Btn>
          {start > 2 && <span className="text-[#94A3B8] text-xs">…</span>}
        </>
      )}
      {pages.map((p) => (
        <Btn key={p} onClick={() => onPageChange(p)} active={p === page}>
          {p}
        </Btn>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-[#94A3B8] text-xs">…</span>}
          <Btn onClick={() => onPageChange(totalPages)}>{totalPages}</Btn>
        </>
      )}
      <Btn onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
        <ChevronRight className="w-[14px] h-[14px]" />
      </Btn>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const STOCK_OPTIONS = [
  { value: "all", label: "সব" },
  { value: "instock", label: "স্টক আছে" },
  { value: "low", label: "কম স্টক" },
  { value: "out", label: "স্টক নেই" },
];

export default function Products() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  // ─── Frontend permission check ──────────────────────────────────────────────
  if (!isAdmin && !user?.permissions?.manageProducts) {
    return <Popup type="denied" message="পণ্য ব্যবস্থাপনা দেখার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }

  const [activeType, setActiveType] = useState("medicine");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null);
  const [offlinePopup, setOfflinePopup] = useState(false); // ← new
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [totalsByType, setTotalsByType] = useState({ medicine: 0, product: 0, service: 0 });
  // ─── Per-type limits ─────────────────────────────────────────────────────
  // Comes straight from GET /products (backend reads limit.maxMedicine /
  // maxProduct / maxService off the lab record). null means "no limit set"
  // for that type — mirrors maxReferrer in ManageReferrer.jsx.
  const [maxByType, setMaxByType] = useState({ medicine: null, product: null, service: null });
  const debounceRef = useRef(null);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, DEBOUNCE_MS);
  };

  const fetchItems = async (firstLoad = false) => {
    if (firstLoad) setInitialLoading(true);
    setError("");
    try {
      const res = await productService.getProducts({ type: activeType, search: debouncedSearch, page, limit: LIMIT });
      setItems(res.data?.products ?? []);
      setPagination(res.data?.pagination ?? { total: 0, page: 1, limit: LIMIT, totalPages: 0 });
      if (res.data?.totalsByType) setTotalsByType(res.data.totalsByType);
      if (res.data?.maxByType) setMaxByType(res.data.maxByType);
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        const message = getErrorMessage(err, "আইটেম লোড করতে ব্যর্থ।");
        setError(message);
        if (err?.response?.status === 403) setPopup({ type: "error", message });
      }
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(true);
  }, []); // eslint-disable-line
  useEffect(() => {
    if (!initialLoading) fetchItems();
  }, [activeType, debouncedSearch, page]); // eslint-disable-line

  const handleTabChange = (type) => {
    setActiveType(type);
    setSearch("");
    setDebouncedSearch("");
    setStockFilter("all");
    setPage(1);
  };

  const openDeleteModal = (item) => {
    setModal({ type: "delete", item });
  };

  const closeDeleteModal = () => {
    setModal(null);
  };

  const handleDelete = async () => {
    try {
      await productService.deleteProduct(modal.item._id);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchItems();
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        const message = getErrorMessage(err, "মুছতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
        setPopup({ type: "error", message });
      }
    }
  };

  const handleSave = () => {
    setModal(null);
    fetchItems();
  };

  const handleNetworkError = () => setOfflinePopup(true);

  const typeDef = ITEM_TYPES[activeType];
  const TypeIcon = typeDef.icon;

  // ─── Active type's limit ─────────────────────────────────────────────────
  // Per-type now, not a flat catalog-wide cap. atLimit only ever gates the
  // *currently active* tab's "New Item" button — creating in one type never
  // blocks creating in another.
  const activeMax = maxByType[activeType];
  const activeCount = totalsByType[activeType] ?? 0;
  const atLimit = activeMax !== null && activeCount >= activeMax;

  const filteredItems = items.filter((item) => {
    if (stockFilter === "all" || !typeDef.hasStock) return true;
    const s = item.stock ?? 0;
    if (stockFilter === "out") return s === 0;
    if (stockFilter === "low") return s > 0 && s <= 5;
    if (stockFilter === "instock") return s > 5;
    return true;
  });

  const hasFilters = search !== "" || stockFilter !== "all";

  const stats = {
    total: pagination.total,
    medicine: totalsByType.medicine,
    product: totalsByType.product,
    service: totalsByType.service,
  };

  return (
    <section className={`min-h-screen px-4 py-6 ${pageGradientBg} font-[Noto_Sans_Bengali,sans-serif]`}>
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      {/* Modals */}
      {modal?.type === "create" && (
        <CreateItemModal
          activeType={activeType}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onNetworkError={handleNetworkError}
        />
      )}
      {modal?.type === "info" && (
        <InfoModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onNetworkError={handleNetworkError}
        />
      )}
      {modal?.type === "price" && (
        <PriceModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onNetworkError={handleNetworkError}
        />
      )}
      {modal?.type === "delete" && (
        <Popup
          type="warning"
          message={`${modal.item.name} স্থায়ীভাবে ডিলিট হয়ে যাবে।`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onClose={closeDeleteModal}
        />
      )}
      {modal?.type === "stock" && (
        <StockModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onNetworkError={handleNetworkError}
        />
      )}

      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl shadow-md"
              style={{ background: typeDef.grad, boxShadow: `0 4px 10px ${typeDef.accent}35` }}
            >
              <TypeIcon className="w-[18px] h-[18px] text-white" />
            </div>
            <div>
              <h1 className="font-['IBM_Plex_Sans',sans-serif] text-[22px] font-bold text-[#0F172A] leading-tight">
                পণ্য ব্যবস্থাপনা
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/setup"
              aria-label="Back"
              className="flex items-center justify-center w-9 h-9 shrink-0 transition-all border-[1.5px] border-[#E2E8F0] rounded-xl text-[#64748B] bg-white hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <ArrowLeft className="w-[15px] h-[15px]" />
            </Link>
            <button
              onClick={() => !atLimit && setModal({ type: "create" })}
              disabled={atLimit}
              title={atLimit ? `সর্বোচ্চ ${activeMax}টি ${typeDef.bangla}` : undefined}
              className="flex items-center gap-1.5 transition-all font-semibold px-4 py-2 rounded-xl text-white font-['IBM_Plex_Mono',monospace] text-xs border-none disabled:cursor-not-allowed"
              style={{
                background: atLimit ? C.muted : typeDef.grad,
                boxShadow: atLimit ? "none" : `0 4px 14px ${typeDef.accent}40`,
              }}
            >
              {atLimit ? <Lock className="w-[13px] h-[13px]" /> : <Plus className="w-[13px] h-[13px]" />}
              নতুন {typeDef.bangla}
            </button>
          </div>
        </div>

        {/* Stats */}
        {!initialLoading && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            <StatCard
              label="মোট"
              value={stats.medicine + stats.product + stats.service}
              color={C.ink}
              grad="linear-gradient(135deg,#0F172A,#1E293B)"
              icon={Grid3X3}
            />
            <StatCard
              label="ওষুধ"
              value={stats.medicine}
              color={C.emerald}
              grad="linear-gradient(135deg,#10B981,#059669)"
              icon={Pill}
            />
            <StatCard
              label="পণ্য"
              value={stats.product}
              color={C.blue}
              grad="linear-gradient(135deg,#3B82F6,#2563EB)"
              icon={Package}
            />
            <StatCard
              label="সেবা"
              value={stats.service}
              color={C.purple}
              grad="linear-gradient(135deg,#8B5CF6,#7C3AED)"
              icon={FlaskConical}
            />
          </div>
        )}

        {atLimit && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 mb-4 bg-[#FEF2F2] border-[1.5px] border-[#EF444430] rounded-xl">
            <Lock className="w-[13px] h-[13px] text-[#EF4444] mt-[1px] shrink-0" />
            <p className="text-[11px] leading-[1.5] text-[#991B1B] font-[Noto_Sans_Bengali,sans-serif]">
              আপনার ল্যাবে সর্বোচ্চ {activeMax}টি {typeDef.bangla} যোগ করা যাবে এবং আপনি সীমায় পৌঁছেছেন। নতুন{" "}
              {typeDef.bangla} যোগ করতে সীমা বাড়াতে আমাদের সাথে যোগাযোগ করুন।
            </p>
          </div>
        )}

        {/* Type tab card */}
        <div className="px-4 py-3 mb-4 bg-white border border-[#E2E8F0] rounded-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            {Object.values(ITEM_TYPES).map((t) => {
              const Icon = t.icon;
              const isActive = t.key === activeType;
              const tMax = maxByType[t.key];
              const tCount = totalsByType[t.key] ?? 0;
              const tAtLimit = tMax !== null && tCount >= tMax;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className="flex items-center gap-1.5 px-3 py-2 font-['IBM_Plex_Mono',monospace] text-[11px] font-bold rounded-xl border-[1.5px] transition-all"
                  style={
                    isActive
                      ? { color: t.accent, borderColor: `${t.accent}60`, background: `${t.accent}08` }
                      : { color: C.muted, borderColor: C.border, background: "white" }
                  }
                >
                  <Icon className="w-3 h-3" />
                  {t.bangla}
                  <span
                    className="font-['IBM_Plex_Mono',monospace] text-[9px] font-bold px-1.5 py-px rounded-[5px]"
                    style={
                      isActive
                        ? { color: t.accent, background: `${t.accent}12`, border: `1px solid ${t.accent}25` }
                        : { color: C.muted, background: "#F1F5F9" }
                    }
                  >
                    {tMax !== null ? `${tCount}/${tMax}` : tCount}
                  </span>
                  {tAtLimit && <Lock className="w-[10px] h-[10px]" style={{ color: C.red }} />}
                </button>
              );
            })}
            {activeMax !== null && (
              <div className="ml-auto flex items-center gap-2">
                <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#94A3B8]">
                  {activeCount}/{activeMax}
                </span>
                <div className="w-16 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((activeCount / activeMax) * 100, 100)}%`,
                      background: atLimit ? C.red : activeCount / activeMax > 0.8 ? C.amber : C.teal,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar card */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 mb-4 bg-white border border-[#E2E8F0] rounded-2xl">
          <div className="relative flex-[1_1_160px]">
            <Search className="w-[13px] h-[13px] text-[#94A3B8] absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={`${typeDef.bangla} খুঁজুন…`}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={`${inputBase} pl-8 ${search ? "pr-8" : "pr-3"} py-2 text-xs`}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#94A3B8]"
              >
                <X className="w-[13px] h-[13px]" />
              </button>
            )}
          </div>
          {typeDef.hasStock && <FilterDropdown value={stockFilter} onChange={setStockFilter} options={STOCK_OPTIONS} />}
          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setStockFilter("all");
              }}
              className="flex items-center gap-1.5 transition-all font-semibold py-[7px] px-3 border-[1.5px] border-[#EF444430] rounded-[10px] text-[#EF4444] font-['IBM_Plex_Mono',monospace] text-[11px] bg-[#EF444406] hover:bg-[#EF444412]"
            >
              <RotateCcw className="w-3 h-3" /> রিসেট
            </button>
          )}
        </div>

        {/* Item cards */}
        {initialLoading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#94A3B8] bg-white border border-[#E2E8F0] rounded-2xl">
            <AlertCircle className="w-7 h-7 opacity-40" />
            <p className="font-['IBM_Plex_Mono',monospace] text-xs text-[#EF4444]">{error}</p>
            <button
              onClick={() => fetchItems()}
              className="font-['IBM_Plex_Mono',monospace] text-xs text-[#0D9488] underline"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#94A3B8] bg-white border border-[#E2E8F0] rounded-2xl">
            <TypeIcon className="w-7 h-7 opacity-40" />
            <p className="font-['IBM_Plex_Mono',monospace] text-xs">
              {hasFilters ? "কোনো আইটেম পাওয়া যায়নি" : `এখনো কোনো ${typeDef.bangla} যোগ করা হয়নি`}
            </p>
            {!hasFilters && !atLimit && (
              <button
                onClick={() => setModal({ type: "create" })}
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: typeDef.grad }}
              >
                + প্রথম {typeDef.bangla} যোগ করুন
              </button>
            )}
          </div>
        ) : (
          <div>
            <SectionDivider title={typeDef.bangla} count={filteredItems.length} color={typeDef.accent} />
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onEditInfo={(i) => setModal({ type: "info", item: i })}
                  onEditPrice={(i) => setModal({ type: "price", item: i })}
                  onDelete={openDeleteModal}
                  onAdjustStock={(i) => setModal({ type: "stock", item: i })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {!initialLoading && pagination.totalPages > 1 && (
          <div className="mt-4 px-4 py-3 bg-white border border-[#E2E8F0] rounded-2xl">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        )}

        {/* Footer note */}
        <p className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#94A3B8] mt-4 text-center">
          {activeMax !== null
            ? `* সর্বোচ্চ ${activeMax}টি ${typeDef.bangla} · বর্তমানে ${activeCount}টি`
            : `* বর্তমানে ${activeCount}টি ${typeDef.bangla}`}
        </p>
      </div>
    </section>
  );
}
