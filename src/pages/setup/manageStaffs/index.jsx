/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  ArrowLeft,
  Search,
  X,
  RotateCcw,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  ChevronDown,
  Phone,
  Mail,
  Trash2,
  Pencil,
  UserX,
  UserCheck,
  Wallet,
  Receipt,
  BanknoteArrowUp,
  FileBarChart,
  FlaskConical,
  Settings2,
  CreditCard,
  BedDouble,
  Lock,
  Send,
} from "lucide-react";
import Popup from "../../../components/popup";
import staffService from "../../../api/staff";
import staticDataAPI from "../../../api/staticData";
import { useAuthStore } from "../../../store/authStore";

/* ────────────────────────────────────────────────────────────────────────
   SLATE — flat design tokens, matching Setup.jsx / Layout.jsx theming.
   ──────────────────────────────────────────────────────────────────────── */
const INK = "#0F172A";
const INK_MUTE = "#64748B";
const PAPER = "#FFFFFF";
const GROUND = "#F8FAFC";
const LINE = "#E2E8F0";
const TEAL = "#2563EB"; // primary blue
const TEAL_DARK = "#1D4ED8";
const TEAL_TINT = "#EFF6FF";
const RUST = "#E11D48";
const RUST_TINT = "#FFF1F2";
const AMBER = "#D97706";
const AMBER_TINT = "#FFFBEB";
const VIOLET = "#7C3AED";
const VIOLET_TINT = "#F5F3FF";

const dotGround = { backgroundColor: GROUND };
const pageGradientBg = "bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#eef2ff_0%,#f8fafc_45%,#f8fafc_100%)]";
const bn = "font-['Noto_Sans_Bengali',sans-serif]";
const mono = "font-['IBM_Plex_Mono',monospace]";

/* ─── Permission group labels / colors / icons (module-wise) ────────────── */
const GROUP_LABELS = {
  invoice: "ইনভয়েস",
  expense: "খরচ/ব্যয়",
  dailyReport: "দৈনিক রিপোর্ট",
  testReport: "টেস্ট রিপোর্ট",
  setup: "সেটআপ",
  billing: "বিলিং",
  indoorPatient: "ভর্তি রোগী (ইনডোর)",
};

// All groups now use the same primary blue – no more per-module color.
const GROUP_META = {
  invoice: { color: TEAL, tint: TEAL_TINT, icon: Receipt },
  expense: { color: TEAL, tint: TEAL_TINT, icon: BanknoteArrowUp },
  dailyReport: { color: TEAL, tint: TEAL_TINT, icon: FileBarChart },
  testReport: { color: TEAL, tint: TEAL_TINT, icon: FlaskConical },
  setup: { color: TEAL, tint: TEAL_TINT, icon: Settings2 },
  billing: { color: TEAL, tint: TEAL_TINT, icon: CreditCard },
  indoorPatient: { color: TEAL, tint: TEAL_TINT, icon: BedDouble },
};

const groupMeta = (groupKey) => GROUP_META[groupKey] ?? { color: TEAL, tint: TEAL_TINT, icon: Shield };

/* ─── Status / filter options ─────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: "all", label: "সব স্ট্যাটাস" },
  { value: "active", label: "সক্রিয়" },
  { value: "inactive", label: "নিষ্ক্রিয়" },
];

const EMPTY_FORM = { name: "", email: "", phone: "" };

/* ─── Error helpers ────────────────────────────────────────────────────── */
const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";
const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return err?.response?.data?.error ?? PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};
const getErrorStatus = (error) => error?.response?.status ?? error?.status ?? null;
const buildInitialPerms = (list) => Object.fromEntries(list.map((p) => [p.key, false]));

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

/* ─── Portal shell (Sheet) ─────────────────────────────────────────────── */
const Sheet = ({ isOpen, onClose, children, width = "480px" }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1C2321]/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-h-[92vh] flex flex-col overflow-hidden border"
        style={{
          maxWidth: width,
          background: PAPER,
          borderColor: LINE,
          borderRadius: "14px",
          boxShadow: "0 20px 50px rgba(28,35,33,0.22), 0 2px 8px rgba(28,35,33,0.08)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

/* ─── Primitives ───────────────────────────────────────────────────────── */
const Field = ({ label, required, hint, children }) => (
  <div>
    {label && (
      <label
        className={`block text-[11px] font-semibold uppercase tracking-[0.09em] mb-1.5 ${mono}`}
        style={{ color: INK_MUTE }}
      >
        {label}
        {required && <span style={{ color: RUST, marginLeft: 3 }}>*</span>}
      </label>
    )}
    {children}
    {hint && (
      <p className={`text-[10px] mt-1 ${mono}`} style={{ color: INK_MUTE }}>
        {hint}
      </p>
    )}
  </div>
);

const inputBase = `w-full px-3 py-2.5 text-sm bg-white outline-none transition-colors placeholder:text-[#B8B2A2] ${bn}`;
const inputStyle = { border: `1px solid ${LINE}`, borderRadius: "7px", color: INK };

const TextInput = ({ label, required, hint, ...props }) => (
  <Field label={label} required={required} hint={hint}>
    <input
      className={inputBase}
      style={inputStyle}
      onFocus={(e) => (e.target.style.borderColor = TEAL)}
      onBlur={(e) => (e.target.style.borderColor = LINE)}
      {...props}
    />
  </Field>
);

const MonoInput = ({ label, required, hint, ...props }) => (
  <Field label={label} required={required} hint={hint}>
    <input
      className={`${inputBase} ${mono} tracking-wide`}
      style={inputStyle}
      onFocus={(e) => (e.target.style.borderColor = TEAL)}
      onBlur={(e) => (e.target.style.borderColor = LINE)}
      {...props}
    />
  </Field>
);

const SwitchToggle = ({ active, onChange, onLabel = "On", offLabel = "Off", onTone = TEAL }) => (
  <button type="button" onClick={() => onChange(!active)} className="flex items-center gap-2.5 select-none">
    <span
      className="relative inline-flex items-center shrink-0 transition-colors duration-200"
      style={{
        width: "38px",
        height: "22px",
        borderRadius: "999px",
        background: active ? onTone : "#CBD5E1",
      }}
    >
      <span
        className="absolute top-[2px] bg-white rounded-full shadow-sm transition-all duration-200"
        style={{
          width: "18px",
          height: "18px",
          left: active ? "18px" : "2px",
        }}
      />
    </span>
    <span className={`text-xs font-bold ${mono}`} style={{ color: active ? onTone : INK_MUTE }}>
      {active ? onLabel : offLabel}
    </span>
  </button>
);

const StatusStamp = ({ active }) => (
  <span
    className={`inline-flex items-center gap-1 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.08em] select-none ${mono}`}
    style={{
      color: active ? TEAL_DARK : "#9B9587",
      border: `1px dashed ${active ? TEAL : "#C7C1B2"}`,
      borderRadius: "2px",
      transform: "rotate(-1.5deg)",
    }}
  >
    {active ? "সক্রিয়" : "নিষ্ক্রিয়"}
  </span>
);

const PermCheck = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-center gap-2 cursor-pointer select-none text-left bg-transparent border-none p-0"
  >
    <span
      className="w-[15px] h-[15px] flex items-center justify-center transition-colors shrink-0"
      style={{
        border: `1.5px solid ${checked ? TEAL : LINE}`,
        borderRadius: "2px",
        background: checked ? TEAL : "white",
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    <span className={`text-sm font-medium leading-snug ${bn}`} style={{ color: checked ? INK : INK_MUTE }}>
      {label}
    </span>
  </button>
);

const GhostBtn = ({ children, ...props }) => (
  <button
    type="button"
    className={`px-3.5 py-2 text-xs font-semibold bg-white transition-colors ${mono}`}
    style={{ color: INK_MUTE, border: `1px solid ${LINE}`, borderRadius: "7px" }}
    {...props}
  >
    {children}
  </button>
);

const SolidBtn = ({ children, tone = TEAL, toneDark = TEAL_DARK, loading, ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm disabled:opacity-60 ${mono}`}
    style={{
      background: `linear-gradient(135deg, ${tone}, ${toneDark})`,
      borderRadius: "7px",
      boxShadow: `0 2px 8px ${tone}40`,
    }}
    onMouseEnter={(e) => !props.disabled && (e.currentTarget.style.filter = "brightness(1.08)")}
    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    {...props}
  >
    {loading && <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
    {children}
  </button>
);

const IconBtn = ({ icon: Icon, tone = INK_MUTE, tint = "#F1EFE7", title, ...props }) => (
  <button
    title={title}
    type="button"
    className="w-7 h-7 flex items-center justify-center transition-colors"
    style={{ color: INK_MUTE, border: `1px solid ${LINE}`, borderRadius: "7px", background: "white" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = tone;
      e.currentTarget.style.background = tint;
      e.currentTarget.style.borderColor = tone;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = INK_MUTE;
      e.currentTarget.style.background = "white";
      e.currentTarget.style.borderColor = LINE;
    }}
    {...props}
  >
    <Icon size={12} />
  </button>
);

const ActionBtn = ({ icon: Icon, label, tone = INK_MUTE, tint = "#F1EFE7", ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${mono}`}
    style={{ color: tone, border: `1px solid ${tone}35`, borderRadius: "5px", background: "white" }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = tint;
      e.currentTarget.style.borderColor = tone;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "white";
      e.currentTarget.style.borderColor = `${tone}35`;
    }}
    {...props}
  >
    <Icon size={12} />
    {label}
  </button>
);

const Avatar = ({ name, color, tint }) => {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`w-10 h-10 flex items-center justify-center shrink-0 text-[14px] font-bold ${mono}`}
      style={{ background: tint, color, borderRadius: "9px" }}
    >
      {initial}
    </div>
  );
};

const FilterSelect = ({ value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none outline-none cursor-pointer transition-colors text-xs py-[7px] pl-3 pr-[28px] bg-white ${bn}`}
      style={{
        border: `1px solid ${value !== "all" ? TEAL : LINE}`,
        borderRadius: "3px",
        color: value !== "all" ? TEAL_DARK : INK_MUTE,
        background: value !== "all" ? TEAL_TINT : "white",
        boxShadow: value !== "all" ? "0 1px 2px rgba(37,99,235,0.12)" : "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={12}
      className="absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: INK_MUTE }}
    />
  </div>
);

const SectionDivider = ({ title, count, color }) => (
  <div className="flex items-center gap-2 pt-1 pb-2.5 first:pt-0">
    <span className={`text-[10.5px] font-extrabold uppercase tracking-[0.1em] ${mono}`} style={{ color }}>
      {title}
    </span>
    <span
      className={`text-[10px] font-bold px-1.5 py-px ${mono}`}
      style={{ color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: "3px" }}
    >
      {count}
    </span>
    <span className="flex-1 border-b" style={{ borderColor: LINE }} />
  </div>
);

const StatCard = ({ icon: Icon, label, value, tone = TEAL, tint = TEAL_TINT }) => (
  <div
    className="flex items-center gap-3 px-4 py-3.5 transition-shadow"
    style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: "4px" }}
    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 3px 10px rgba(28,35,33,0.06)")}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
  >
    <div
      className="w-10 h-10 flex items-center justify-center shrink-0"
      style={{ background: tint, color: tone, borderRadius: "3px" }}
    >
      <Icon size={17} />
    </div>
    <div>
      <p className={`text-[26px] font-extrabold leading-none ${mono}`} style={{ color: INK }}>
        {value}
      </p>
      <p className={`text-[9px] font-bold uppercase tracking-[0.06em] mt-2 ${mono}`} style={{ color: INK_MUTE }}>
        {label}
      </p>
    </div>
  </div>
);

const Skeleton = () => (
  <div className="flex flex-col gap-2 p-4">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-4 py-3 animate-pulse"
        style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: "8px" }}
      >
        <div className="w-9 h-9 shrink-0" style={{ background: "#EEEBE1", borderRadius: "9px" }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/5" style={{ background: "#EEEBE1", borderRadius: "2px" }} />
          <div className="h-2.5 w-3/5" style={{ background: "#F2F0E8", borderRadius: "2px" }} />
        </div>
      </div>
    ))}
  </div>
);

/* ─── Grouped permissions block ────────────────────────────────────────── */
const PermissionGroups = ({ permissionsList, permissions, onTogglePerm, onToggleGroup }) => {
  const grouped = permissionsList.reduce((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([groupKey, perms]) => {
        const meta = groupMeta(groupKey);
        const GIcon = meta.icon;
        const enabledCount = perms.filter((p) => permissions[p.key]).length;
        const allEnabled = enabledCount === perms.length;
        const hasSome = enabledCount > 0;

        // All groups now use the same primary blue for consistency
        const uniformColor = TEAL;
        const uniformTint = TEAL_TINT;

        return (
          <div key={groupKey} style={{ border: `1px solid ${LINE}`, borderRadius: "2px", background: "white" }}>
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5"
              style={{ borderBottom: `1px solid ${LINE}`, background: hasSome ? uniformTint : GROUND }}
            >
              <div
                className="w-6 h-6 flex items-center justify-center shrink-0"
                style={{
                  background: hasSome ? "white" : "#EEEBE1",
                  color: hasSome ? uniformColor : INK_MUTE,
                  borderRadius: "2px",
                }}
              >
                <GIcon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  {/* Module name – no background, no border, blends with header */}
                  <span
                    className={`text-[12px] font-extrabold uppercase tracking-[0.06em] px-2.5 py-1 ${bn}`}
                    style={{
                      color: uniformColor,
                      background: "transparent",
                      border: "none",
                      borderRadius: "0px",
                      boxShadow: "none",
                    }}
                  >
                    {GROUP_LABELS[groupKey] ?? groupKey}
                  </span>
                  <span className={`text-[9.5px] font-bold ${mono}`} style={{ color: INK_MUTE }}>
                    {enabledCount}/{perms.length}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleGroup(perms, allEnabled)}
                className={`shrink-0 text-[9.5px] font-bold px-2 py-[4px] ${mono}`}
                style={{
                  color: allEnabled ? RUST : uniformColor,
                  background: allEnabled ? RUST_TINT : "white",
                  border: `1px solid ${allEnabled ? RUST : uniformColor}40`,
                  borderRadius: "2px",
                }}
              >
                {allEnabled ? "বাদ দিন" : "সব নিন"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 px-3.5 py-3">
              {perms.map(({ key, label }) => (
                <PermCheck
                  key={key}
                  label={label}
                  checked={!!permissions[key]}
                  onChange={(v) => onTogglePerm(key, v)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Staff Form Modal (create / edit permissions) — now 880px wide ──── */
const StaffFormModal = ({ initial, permissionsList, onClose, onSaved, atStaffLimit, maxStaff }) => {
  const isEdit = !!initial?._id;
  const isAdmin = initial?.role === "admin";

  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        name: initial.name ?? "",
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        permissions: initial.permissions ?? buildInitialPerms(permissionsList),
      };
    }
    return { ...EMPTY_FORM, permissions: buildInitialPerms(permissionsList) };
  });

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [adjustmentEnabled, setAdjustmentEnabled] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (apiError) setApiError("");
  };

  const togglePerm = (key, val) => set("permissions", { ...form.permissions, [key]: val });
  const toggleGroup = (groupPerms, groupAllEnabled) =>
    set("permissions", {
      ...form.permissions,
      ...Object.fromEntries(groupPerms.map((p) => [p.key, !groupAllEnabled])),
    });

  const allEnabled = permissionsList.every((p) => form.permissions[p.key]);
  const toggleAll = () => set("permissions", Object.fromEntries(permissionsList.map((p) => [p.key, !allEnabled])));
  const enabledTotal = permissionsList.filter((p) => form.permissions[p.key]).length;

  const handleSubmit = async () => {
    if (!isEdit) {
      // Re-check the seat limit right before submit, not just at the point
      // the modal was opened — covers a modal left open in a background tab
      // while another admin fills the last seat elsewhere. No API call is
      // made when this fires; the backend check is still there as a
      // second, authoritative guard for direct API access.
      if (atStaffLimit) {
        return setApiError(
          `আপনার প্ল্যানে সর্বোচ্চ ${maxStaff} জন স্টাফ যোগ করা যাবে। সীমা বাড়াতে আপনার প্ল্যান আপগ্রেড করুন।`,
        );
      }
      if (!form.name.trim()) return setApiError("নাম প্রয়োজন।");
      if (!form.phone.trim()) return setApiError("ফোন নম্বর প্রয়োজন।");
      if (adjustmentEnabled && (!adjustmentAmount || Number(adjustmentAmount) <= 0)) {
        return setApiError("অ্যাডজাস্টমেন্ট লিমিট প্রয়োজন।");
      }
    }
    try {
      setSaving(true);
      setApiError("");
      if (isEdit) {
        await staffService.updatePermissions({ permissions: form.permissions, _id: initial._id });
      } else {
        const { name, email, phone, permissions } = form;
        await staffService.addStaff({
          name,
          email,
          phone,
          permissions,
          maxLabAdjustment: adjustmentEnabled ? Number(adjustmentAmount) : 0,
        });
      }
      onSaved(isEdit);
    } catch (err) {
      // A STAFF_LIMIT_REACHED response arrives here too (e.g. another admin
      // filled the last seat between page load and submit) — the backend's
      // Bangla message is shown as-is via getErrorMessage, same as any other
      // API error, so no special-casing is needed on this path.
      setApiError(getErrorMessage(err, "সমস্যা হয়েছে। আবার চেষ্টা করুন।"));
    } finally {
      setSaving(false);
    }
  };

  const tone = isEdit ? VIOLET : TEAL;
  const toneDark = isEdit ? "#6D28D9" : TEAL_DARK;

  return (
    <Sheet isOpen width="880px">
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: LINE, background: PAPER }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: tone, borderRadius: "9px" }}
          >
            {isEdit ? <Pencil size={15} className="text-white" /> : <UserPlus size={15} className="text-white" />}
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px] ${mono}`} style={{ color: tone }}>
              {isEdit ? "অনুমতি সম্পাদনা" : "কর্মী নিবন্ধন"}
            </p>
            <p className={`text-base font-bold leading-none ${bn}`} style={{ color: INK }}>
              {isEdit ? initial.name : "নতুন স্টাফ যোগ করুন"}
            </p>
          </div>
        </div>
        <IconBtn icon={X} onClick={onClose} title="Close" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4" style={dotGround}>
        {!isEdit && (
          <div
            className="p-4 space-y-4"
            style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: "10px" }}
          >
            <TextInput
              label="পূর্ণ নাম"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="কর্মীর নাম"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                label="ইমেইল"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@example.com"
              />
              <TextInput
                label="ফোন নম্বর"
                required
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="01XXXXXXXXX"
                maxLength={15}
              />
            </div>

            <div style={{ border: `1px solid ${LINE}`, borderRadius: "9px", background: "white" }}>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Wallet size={13} style={{ color: TEAL }} />
                  <span
                    className={`text-[11px] font-bold uppercase tracking-[0.08em] ${mono}`}
                    style={{ color: INK_MUTE }}
                  >
                    বিল অ্যাডজাস্টমেন্ট
                  </span>
                </div>
                <SwitchToggle
                  active={adjustmentEnabled}
                  onChange={(v) => {
                    setAdjustmentEnabled(v);
                    if (!v) setAdjustmentAmount(0);
                    if (apiError) setApiError("");
                  }}
                />
              </div>
              {adjustmentEnabled && (
                <div className="px-4 pb-3.5 border-t pt-3.5" style={{ borderColor: LINE }}>
                  <MonoInput
                    type="number"
                    min="0"
                    value={adjustmentAmount === 0 ? "" : adjustmentAmount}
                    onChange={(e) => {
                      setAdjustmentAmount(e.target.value === "" ? "" : Number(e.target.value));
                      if (apiError) setApiError("");
                    }}
                    placeholder="সর্বোচ্চ পরিমাণ (৳)"
                    autoFocus
                  />
                  <p className={`mt-1 text-[10px] ${bn}`} style={{ color: INK_MUTE }}>
                    এই কর্মী সর্বোচ্চ এই পরিমাণ পর্যন্ত বিল অ্যাডজাস্টমেন্ট করতে পারবেন।
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {isEdit && !isAdmin && (
          <div
            className="flex items-start gap-2.5 px-3.5 py-2.5"
            style={{ border: `1px solid ${LINE}`, borderRadius: "10px", background: GROUND }}
          >
            <AlertCircle size={13} style={{ color: INK_MUTE, marginTop: 1 }} />
            <p className={`text-[10.5px] leading-[1.5] ${bn}`} style={{ color: INK_MUTE }}>
              নাম, ইমেইল ও ফোন নম্বর নিবন্ধনের পর পরিবর্তনযোগ্য নয়। স্ট্যাটাস ও অ্যাডজাস্টমেন্ট লিমিট তালিকার অ্যাকশন
              বাটন থেকে পরিবর্তন করুন।
            </p>
          </div>
        )}

        {!isAdmin && (
          <div className="p-4" style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: "10px" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield size={12} style={{ color: TEAL }} />
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.08em] ${mono}`}
                  style={{ color: INK_MUTE }}
                >
                  অনুমতিসমূহ
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className={`text-[10px] font-bold px-2 py-[3px] ${mono}`}
                style={{
                  color: allEnabled ? RUST : TEAL,
                  background: allEnabled ? RUST_TINT : TEAL_TINT,
                  borderRadius: "2px",
                }}
              >
                {allEnabled ? "সব বাদ দিন" : "সব নির্বাচন করুন"}
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-[5px]" style={{ background: LINE, borderRadius: "2px" }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${(enabledTotal / (permissionsList.length || 1)) * 100}%`,
                    background: TEAL,
                    borderRadius: "2px",
                  }}
                />
              </div>
              <span className={`text-[10px] font-semibold shrink-0 ${mono}`} style={{ color: INK_MUTE }}>
                {enabledTotal}/{permissionsList.length}
              </span>
            </div>
            <PermissionGroups
              permissionsList={permissionsList}
              permissions={form.permissions}
              onTogglePerm={togglePerm}
              onToggleGroup={toggleGroup}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white border-t" style={{ borderColor: LINE }}>
        {apiError && (
          <div
            className="mx-5 mt-4 flex items-start gap-2.5 px-4 py-3"
            style={{ background: RUST_TINT, border: `1px solid ${RUST}40`, borderRadius: "8px" }}
          >
            <AlertCircle size={14} style={{ color: RUST, marginTop: 1 }} />
            <span className={`text-xs ${mono}`} style={{ color: RUST }}>
              {apiError}
            </span>
          </div>
        )}
        <div className="px-5 py-4 flex gap-2 justify-end">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <SolidBtn tone={tone} toneDark={toneDark} onClick={handleSubmit} disabled={saving} loading={saving}>
            {isEdit ? "Save Changes" : "Add Staff"}
          </SolidBtn>
        </div>
      </div>
    </Sheet>
  );
};

/* ─── Adjustment Limit Modal ────────────────────────────────────────────── */
const AdjustmentModal = ({ member, onClose, onSaved }) => {
  const [enabled, setEnabled] = useState((member.maxLabAdjustment ?? 0) > 0);
  const [amount, setAmount] = useState(member.maxLabAdjustment ?? 0);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleSubmit = async () => {
    if (enabled && (!amount || Number(amount) <= 0)) return setApiError("অ্যাডজাস্টমেন্ট লিমিট প্রয়োজন।");
    try {
      setSaving(true);
      setApiError("");
      await staffService.updateAdjustment({ maxLabAdjustment: enabled ? Number(amount) : 0, _id: member._id });
      onSaved();
    } catch (err) {
      setApiError(getErrorMessage(err, "সমস্যা হয়েছে। আবার চেষ্টা করুন।"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet isOpen width="420px">
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: LINE, background: PAPER }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: AMBER, borderRadius: "9px" }}
          >
            <Wallet size={15} className="text-white" />
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-[2px] ${mono}`} style={{ color: AMBER }}>
              অ্যাডজাস্টমেন্ট লিমিট
            </p>
            <p className={`text-base font-bold leading-none ${bn}`} style={{ color: INK }}>
              {member.name}
            </p>
          </div>
        </div>
        <IconBtn icon={X} onClick={onClose} title="Close" />
      </div>

      <div className="p-5" style={dotGround}>
        <div style={{ border: `1px solid ${LINE}`, borderRadius: "9px", background: "white" }}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Wallet size={13} style={{ color: AMBER }} />
              <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${mono}`} style={{ color: INK_MUTE }}>
                বিল অ্যাডজাস্টমেন্ট
              </span>
            </div>
            <SwitchToggle
              active={enabled}
              onTone={AMBER}
              onChange={(v) => {
                setEnabled(v);
                if (!v) setAmount(0);
                if (apiError) setApiError("");
              }}
            />
          </div>
          {enabled && (
            <div className="px-4 pb-3.5 border-t pt-3.5" style={{ borderColor: LINE }}>
              <MonoInput
                type="number"
                min="0"
                value={amount === 0 ? "" : amount}
                onChange={(e) => {
                  setAmount(e.target.value === "" ? "" : Number(e.target.value));
                  if (apiError) setApiError("");
                }}
                placeholder="সর্বোচ্চ পরিমাণ (৳)"
                autoFocus
              />
              <p className={`mt-1 text-[10px] ${bn}`} style={{ color: INK_MUTE }}>
                এই কর্মী সর্বোচ্চ এই পরিমাণ পর্যন্ত বিল অ্যাডজাস্টমেন্ট করতে পারবেন।
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 bg-white border-t" style={{ borderColor: LINE }}>
        {apiError && (
          <div
            className="mx-5 mt-4 flex items-start gap-2.5 px-4 py-3"
            style={{ background: RUST_TINT, border: `1px solid ${RUST}40`, borderRadius: "8px" }}
          >
            <AlertCircle size={14} style={{ color: RUST, marginTop: 1 }} />
            <span className={`text-xs ${mono}`} style={{ color: RUST }}>
              {apiError}
            </span>
          </div>
        )}
        <div className="px-5 py-4 flex gap-2 justify-end">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <SolidBtn tone={AMBER} toneDark="#B45309" onClick={handleSubmit} disabled={saving} loading={saving}>
            Save
          </SolidBtn>
        </div>
      </div>
    </Sheet>
  );
};

/* ─── Staff Row — modern card design ───────────────────────────────────── */
const ROLE_META = {
  admin: { label: "অ্যাডমিন", color: VIOLET, tint: VIOLET_TINT },
  staff: { label: "স্টাফ", color: TEAL, tint: TEAL_TINT },
};

const StaffRow = ({
  member,
  permissionsList,
  onEdit,
  onAdjust,
  onDelete,
  onDeactivate,
  onActivate,
  onResend,
  resending,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Admins may not carry a `permissions` object from the backend at all
  // (they implicitly have full access), so fall back to {} before indexing
  // into it — otherwise this throws for every admin row.
  const memberPermissions = member.permissions ?? {};
  const activePerms = permissionsList.filter((p) => memberPermissions[p.key]);
  const hasFullAccess = activePerms.length === permissionsList.length;
  const roleMeta = ROLE_META[member.role] ?? { label: "অন্যান্য", color: INK_MUTE, tint: GROUND };

  // Staff who haven't set a password yet (never used their SMS link, or it
  // failed to send) can have a fresh one issued via the resend action below.
  const needsPasswordSetup = member.role !== "admin" && !member.hasPasswordSet;

  return (
    <div
      className="transition-shadow"
      style={{
        background: "white",
        border: `1px solid ${LINE}`,
        borderRadius: "10px",
        opacity: member.isActive ? 1 : 0.65,
        boxShadow: expanded ? "0 4px 14px rgba(28,35,33,0.08)" : "0 1px 2px rgba(28,35,33,0.03)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <Avatar name={member.name} color={roleMeta.color} tint={roleMeta.tint} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold truncate ${bn}`} style={{ color: INK }}>
              {member.name}
            </span>
            <span
              className={`text-[9.5px] font-bold px-1.5 py-px shrink-0 ${mono}`}
              style={{ color: roleMeta.color, background: roleMeta.tint, borderRadius: "3px" }}
            >
              {roleMeta.label}
            </span>
            {!member.isActive && <StatusStamp active={false} />}
            {needsPasswordSetup && (
              <span
                className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-px shrink-0 ${mono}`}
                style={{ color: AMBER, background: AMBER_TINT, borderRadius: "3px" }}
              >
                <Lock size={9} /> পাসওয়ার্ড সেট হয়নি
              </span>
            )}
          </div>
          <p className={`text-[10.5px] mt-0.5 truncate ${mono}`} style={{ color: INK_MUTE }}>
            {member.phone || member.email || "—"}
          </p>
        </div>
        {member.role !== "admin" && (
          <span
            className={`shrink-0 hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold ${mono}`}
            style={{
              color: hasFullAccess ? TEAL_DARK : INK_MUTE,
              background: hasFullAccess ? TEAL_TINT : GROUND,
              borderRadius: "5px",
            }}
          >
            {hasFullAccess && <Shield size={10} />}
            {hasFullAccess ? "সম্পূর্ণ অ্যাক্সেস" : `${activePerms.length}/${permissionsList.length}`}
          </span>
        )}
        <ChevronDown
          size={15}
          style={{ color: INK_MUTE, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: LINE }}>
          <div className="pt-3.5 space-y-3.5">
            <div className={`text-xs leading-loose space-y-0.5 ${mono}`} style={{ color: INK_MUTE }}>
              {member.email && (
                <p className="flex items-center gap-1.5">
                  <Mail size={11} style={{ color: TEAL }} /> {member.email}
                </p>
              )}
              {member.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone size={11} style={{ color: TEAL }} /> {member.phone}
                </p>
              )}
              {member.role !== "admin" && member.maxLabAdjustment > 0 && (
                <p className="flex items-center gap-1.5">
                  <Wallet size={11} style={{ color: TEAL }} /> সর্বোচ্চ অ্যাডজাস্টমেন্ট ৳{member.maxLabAdjustment}
                </p>
              )}
            </div>
            {member.role !== "admin" && (
              <div>
                <p
                  className={`text-[9px] font-bold uppercase tracking-[0.08em] mb-1.5 ${mono}`}
                  style={{ color: INK_MUTE }}
                >
                  অনুমতিসমূহ ({activePerms.length}/{permissionsList.length})
                </p>
                {activePerms.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activePerms.map(({ key, label }) => (
                      <span
                        key={key}
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold ${bn}`}
                        style={{
                          color: TEAL_DARK,
                          background: TEAL_TINT,
                          border: `1px solid ${TEAL}30`,
                          borderRadius: "4px",
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={`text-[11px] italic ${bn}`} style={{ color: INK_MUTE }}>
                    কোনো অনুমতি নেই
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {member.role !== "admin" && (
                <>
                  {needsPasswordSetup && (
                    <ActionBtn
                      icon={Send}
                      label={resending ? "পাঠানো হচ্ছে..." : "Resend Link"}
                      tone={AMBER}
                      tint={AMBER_TINT}
                      onClick={onResend}
                      disabled={resending}
                    />
                  )}
                  <ActionBtn icon={Pencil} label="Permissions" tone={TEAL} tint={TEAL_TINT} onClick={onEdit} />
                  <ActionBtn icon={Wallet} label="Adjustment Limit" tone={AMBER} tint={AMBER_TINT} onClick={onAdjust} />
                  {member.isActive ? (
                    <ActionBtn icon={UserX} label="Deactivate" tone={AMBER} tint={AMBER_TINT} onClick={onDeactivate} />
                  ) : (
                    <ActionBtn icon={UserCheck} label="Activate" tone={TEAL} tint={TEAL_TINT} onClick={onActivate} />
                  )}
                  <ActionBtn icon={Trash2} label="Delete" tone={RUST} tint={RUST_TINT} onClick={onDelete} />
                </>
              )}
              {member.role === "admin" && (
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${bn}`}
                  style={{ color: INK_MUTE }}
                >
                  <Shield size={11} /> অ্যাডমিন অ্যাকাউন্ট সুরক্ষিত
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main Page ────────────────────────────────────────────────────────── */
const ManageStaff = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "admin";
  const labType = user?.type;

  // ─── Frontend permission check (manageStaffs) ─────────────────────────
  const hasAccess = isAdmin || user?.permissions?.manageStaffs === true;
  if (!hasAccess) {
    return (
      <Popup
        type="denied"
        message="স্টাফ অ্যাকাউন্ট ম্যানেজমেন্ট দেখার অনুমতি আপনার নেই।"
        onClose={() => navigate("/")}
      />
    );
  }

  const [staff, setStaff] = useState([]);
  const [maxStaff, setMaxStaff] = useState(null);
  const [permissionsList, setPermissionsList] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [offlinePopup, setOfflinePopup] = useState(false); // ← new
  const [formModal, setFormModal] = useState(null);
  const [adjustModal, setAdjustModal] = useState(null);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [permFilter, setPermFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    const boot = async () => {
      try {
        const [staffRes, permsRes] = await Promise.all([staffService.getStaffs(), staticDataAPI.getStaffPermissions()]);
        setStaff(staffRes.data.staffs);
        setMaxStaff(staffRes.data.maxStaff);
        const visiblePerms = permsRes.data.permissions.filter(
          (p) => p.for !== "hospitalOnly" || labType === "hospital",
        );
        setPermissionsList(visiblePerms);
      } catch (err) {
        if (isNetworkError(err)) {
          setOfflinePopup(true);
        } else {
          setPopup({ type: "error", message: getErrorMessage(err, "ডেটা লোড করতে ব্যর্থ।") });
        }
      } finally {
        setInitialLoading(false);
      }
    };
    boot();
  }, [labType]);

  const loadStaff = async () => {
    try {
      const res = await staffService.getStaffs();
      setStaff(res.data.staffs);
      setMaxStaff(res.data.maxStaff);
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setPopup({ type: "error", message: getErrorMessage(err, "কর্মী লোড করতে ব্যর্থ।") });
      }
    }
  };

  const permFilterOptions = [
    { value: "all", label: "সব অনুমতি" },
    ...permissionsList.map((p) => ({ value: p.key, label: p.label })),
  ];

  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    inactive: staff.filter((s) => !s.isActive).length,
    fullAccess: staff.filter((s) => s.role === "admin" || permissionsList.every((p) => s.permissions?.[p.key])).length,
  };

  // ─── Staff seat limit ────────────────────────────────────────────────
  // maxStaff comes straight from GET /staffs (the backend reads it off the
  // lab record) — no second request needed. null means "no limit set on
  // this lab" rather than "zero seats", so staff creation stays unblocked.
  const staffSeatCount = staff.filter((s) => s.role === "staff").length;
  const atStaffLimit = maxStaff !== null && staffSeatCount >= maxStaff;

  const filtered = staff.filter((s) => {
    // s.permissions may be absent for admins — optional-chain the lookup so
    // filtering by a specific permission simply excludes them instead of
    // throwing.
    if (permFilter !== "all" && !s.permissions?.[permFilter]) return false;
    if (statusFilter === "active" && !s.isActive) return false;
    if (statusFilter === "inactive" && s.isActive) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q);
    }
    return true;
  });

  const admins = filtered.filter((s) => s.role === "admin");
  const staffMembers = filtered.filter((s) => s.role === "staff");
  const others = filtered.filter((s) => s.role !== "admin" && s.role !== "staff");

  const handleSaved = async (isEdit) => {
    setFormModal(null);
    await loadStaff();
    setPopup({ type: "success", message: isEdit ? "কর্মী আপডেট হয়েছে।" : "কর্মী নিবন্ধিত হয়েছে।" });
  };

  const handleAdjustSaved = async () => {
    setAdjustModal(null);
    await loadStaff();
    setPopup({ type: "success", message: "অ্যাডজাস্টমেন্ট লিমিট আপডেট হয়েছে।" });
  };

  const handleDelete = async (member) => {
    try {
      await staffService.deleteStaff(member._id);
      setStaff((prev) => prev.filter((m) => m._id !== member._id));
      setPopup({ type: "success", message: "কর্মী মুছে ফেলা হয়েছে।" });
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        if (getErrorStatus(err) === 404) setStaff((prev) => prev.filter((m) => m._id !== member._id));
        setPopup({ type: "error", message: getErrorMessage(err, "কর্মী মুছতে ব্যর্থ।") });
      }
    }
  };

  const handleToggle = async (member, activate) => {
    try {
      activate ? await staffService.activateStaff(member._id) : await staffService.deactivateStaff(member._id);
      setStaff((prev) => prev.map((m) => (m._id === member._id ? { ...m, isActive: activate } : m)));
      setPopup({ type: "success", message: `কর্মী ${activate ? "সক্রিয়" : "নিষ্ক্রিয়"} করা হয়েছে।` });
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setPopup({ type: "error", message: getErrorMessage(err, "স্ট্যাটাস পরিবর্তন ব্যর্থ।") });
      }
    }
  };

  // Resends the one-time password-set SMS link for a staff member who
  // hasn't set a password yet. The backend refuses (409) once a password
  // exists, so this is only ever wired to the button that's already gated
  // on !member.hasPasswordSet — but the error message still surfaces
  // correctly via getErrorMessage if that ever races with another admin's
  // action.
  const handleResend = async (member) => {
    setResendingId(member._id);
    try {
      const res = await staffService.resendPasswordSetup(member._id);
      setPopup({
        type: res.data.smsSent ? "success" : "error",
        message: res.data.message,
      });
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setPopup({ type: "error", message: getErrorMessage(err, "লিংক পাঠাতে ব্যর্থ।") });
      }
    } finally {
      setResendingId(null);
    }
  };

  // Guarded entry point for opening the "add staff" modal — used by both
  // the header button and the empty-state CTA so the limit check lives in
  // one place.
  const handleAddStaffClick = () => {
    if (atStaffLimit) {
      setPopup({
        type: "error",
        message: `আপনার প্ল্যানে সর্বোচ্চ ${maxStaff} জন স্টাফ যোগ করা যাবে। সীমা বাড়াতে আপনার প্ল্যান আপগ্রেড করুন।`,
      });
      return;
    }
    setFormModal({});
  };

  const hasFilters = permFilter !== "all" || statusFilter !== "all" || search !== "";

  const rowProps = (member) => ({
    member,
    permissionsList,
    onEdit: () => setFormModal(member),
    onAdjust: () => setAdjustModal(member),
    onDelete: () => setModal({ type: "delete", member }),
    onDeactivate: () => setModal({ type: "deactivate", member }),
    onActivate: () => setModal({ type: "activate", member }),
    onResend: () => handleResend(member),
    resending: resendingId === member._id,
  });

  return (
    <section className={`min-h-screen px-4 sm:px-6 py-6 lg:py-8 ${pageGradientBg} ${bn}`}>
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      {formModal !== null && (
        <StaffFormModal
          initial={formModal._id ? formModal : null}
          permissionsList={permissionsList}
          onClose={() => setFormModal(null)}
          onSaved={handleSaved}
          atStaffLimit={atStaffLimit}
          maxStaff={maxStaff}
        />
      )}

      {adjustModal !== null && (
        <AdjustmentModal member={adjustModal} onClose={() => setAdjustModal(null)} onSaved={handleAdjustSaved} />
      )}

      {modal?.type === "delete" && (
        <Popup
          type="warning"
          message={`"${modal.member.name}"-এর সমস্ত তথ্য স্থায়ীভাবে মুছে যাবে। এই কাজ পূর্বাবস্থায় ফেরানো যাবে না।`}
          confirmText="Yes, Delete"
          cancelText="Keep"
          onConfirm={() => handleDelete(modal.member)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "deactivate" && (
        <Popup
          type="warning"
          message={`"${modal.member.name}"-কে নিষ্ক্রিয় করলে তিনি সিস্টেমে প্রবেশ করতে পারবেন না।`}
          confirmText="Yes, Deactivate"
          cancelText="Cancel"
          onConfirm={() => handleToggle(modal.member, false)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "activate" && (
        <Popup
          type="warning"
          message={`"${modal.member.name}"-কে সক্রিয় করলে তিনি পুনরায় সিস্টেমে প্রবেশ করতে পারবেন।`}
          confirmText="Yes, Activate"
          cancelText="Cancel"
          onConfirm={() => handleToggle(modal.member, true)}
          onClose={() => setModal(null)}
        />
      )}

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl shadow-md"
              style={{
                background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
                boxShadow: `0 4px 10px ${TEAL}35`,
              }}
            >
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold leading-tight" style={{ color: INK }}>
                স্টাফ অ্যাকাউন্ট
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/setup">
              <GhostBtn>
                <ArrowLeft size={13} />
              </GhostBtn>
            </Link>
            <SolidBtn
              onClick={handleAddStaffClick}
              disabled={atStaffLimit}
              title={atStaffLimit ? `স্টাফ সীমা (${maxStaff}) পূর্ণ হয়েছে` : undefined}
            >
              {atStaffLimit ? <Lock size={13} /> : <UserPlus size={13} />} নতুন স্টাফ
            </SolidBtn>
          </div>
        </div>

        {!initialLoading && (
          <div className={`grid grid-cols-2 sm:grid-cols-4 ${maxStaff !== null ? "lg:grid-cols-5" : ""} gap-3 mb-5`}>
            <StatCard icon={Users} label="মোট কর্মী" value={stats.total} tone={TEAL} tint={TEAL_TINT} />
            <StatCard icon={ShieldCheck} label="সক্রিয়" value={stats.active} tone={TEAL_DARK} tint={TEAL_TINT} />
            <StatCard icon={ShieldOff} label="নিষ্ক্রিয়" value={stats.inactive} tone={RUST} tint={RUST_TINT} />
            <StatCard
              icon={Shield}
              label="সম্পূর্ণ অ্যাক্সেস"
              value={stats.fullAccess}
              tone={VIOLET}
              tint={VIOLET_TINT}
            />
            {maxStaff !== null && (
              <StatCard
                icon={Lock}
                label="স্টাফ সীমা"
                value={`${staffSeatCount}/${maxStaff}`}
                tone={atStaffLimit ? RUST : AMBER}
                tint={atStaffLimit ? RUST_TINT : AMBER_TINT}
              />
            )}
          </div>
        )}

        {atStaffLimit && (
          <div
            className="flex items-start gap-2.5 px-3.5 py-2.5 mb-4"
            style={{ border: `1px solid ${AMBER}40`, borderRadius: "8px", background: AMBER_TINT }}
          >
            <Lock size={13} style={{ color: AMBER, marginTop: 1 }} />
            <p className={`text-[11px] leading-[1.5] ${bn}`} style={{ color: "#92400E" }}>
              আপনার প্ল্যানে সর্বোচ্চ {maxStaff} জন স্টাফ যোগ করা যাবে এবং আপনি সীমায় পৌঁছেছেন। নতুন স্টাফ যোগ করতে হলে
              আপনার প্ল্যান আপগ্রেড করুন অথবা কোনো বিদ্যমান স্টাফ মুছে ফেলুন।
            </p>
          </div>
        )}

        <div
          className="px-4 py-3 flex flex-wrap items-center gap-2 mb-4"
          style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: "8px" }}
        >
          <div className="relative flex-[1_1_160px]">
            <Search
              size={13}
              className="absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: INK_MUTE }}
            />
            <input
              type="text"
              placeholder="নাম, ইমেইল বা ফোন…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputBase} pl-8 ${search ? "pr-8" : "pr-3"} py-2 text-xs`}
              style={{ ...inputStyle, borderRadius: "3px" }}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer"
                style={{ color: INK_MUTE }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <FilterSelect value={permFilter} onChange={setPermFilter} options={permFilterOptions} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          {hasFilters && (
            <GhostBtn
              onClick={() => {
                setPermFilter("all");
                setStatusFilter("all");
                setSearch("");
              }}
            >
              <span className="flex items-center gap-1.5" style={{ color: RUST }}>
                <RotateCcw size={12} /> রিসেট
              </span>
            </GhostBtn>
          )}
        </div>

        {initialLoading ? (
          <div style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: "8px" }}>
            <Skeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 gap-2"
            style={{ color: INK_MUTE, background: "white", border: `1px solid ${LINE}`, borderRadius: "8px" }}
          >
            <AlertCircle size={26} className="opacity-40" />
            <p className={`text-xs ${mono}`}>
              {hasFilters ? "কোনো কর্মী পাওয়া যায়নি" : "এখনো কোনো কর্মী যোগ করা হয়নি"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {admins.length > 0 && (
              <>
                <SectionDivider title="অ্যাডমিন" count={admins.length} color={VIOLET} />
                <div className="space-y-2 mb-4">
                  {admins.map((m) => (
                    <StaffRow key={m._id} {...rowProps(m)} />
                  ))}
                </div>
              </>
            )}
            {staffMembers.length > 0 && (
              <>
                <SectionDivider title="স্টাফ" count={staffMembers.length} color={TEAL} />
                <div className="space-y-2 mb-4">
                  {staffMembers.map((m) => (
                    <StaffRow key={m._id} {...rowProps(m)} />
                  ))}
                </div>
              </>
            )}
            {others.length > 0 && (
              <>
                <SectionDivider title="অন্যান্য" count={others.length} color={INK_MUTE} />
                <div className="space-y-2">
                  {others.map((m) => (
                    <StaffRow key={m._id} {...rowProps(m)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <p className={`text-[10px] mt-4 text-center ${mono}`} style={{ color: INK_MUTE }}>
          * শুধুমাত্র সক্রিয় কর্মীরা সিস্টেমে প্রবেশ করতে পারবেন
        </p>
      </div>
    </section>
  );
};

export default ManageStaff;
