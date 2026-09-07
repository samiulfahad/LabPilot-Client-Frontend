import { useNavigate } from "react-router-dom";
import { Receipt, FileText, Percent, ArrowLeftRight, Wallet, Tag, Lock } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const reportNav = [
  {
    label: "ক্যাশমেমু",
    path: "/cashmemo",
    icon: Receipt,
    description: "দৈনিক ক্যাশমেমুর হিসাব",
    color: "emerald",
    permission: "cashmemo",
  },
  {
    label: "কালেকশন রিপোর্ট",
    path: "/collection-report",
    icon: ArrowLeftRight,
    description: "আদায়কৃত অর্থের হিসাব",
    color: "sky",
    permission: "collectionReport",
  },
  {
    label: "সেলস রিপোর্ট",
    path: "/sales-report",
    icon: FileText,
    description: "বিক্রয়ের সারসংক্ষেপ",
    color: "indigo",
    permission: "salesReport",
  },
  {
    label: "এক্সপেন্স রিপোর্ট",
    path: "/expense-report",
    icon: Wallet,
    description: "ব্যয়ের সারসংক্ষেপ",
    color: "rose",
    permission: "expenseReport",
  },
  {
    label: "কমিশন রিপোর্ট",
    path: "/commission-report",
    icon: Percent,
    description: "মিডিয়া কমিশনের হিসাব",
    color: "amber",
    permission: "commissionReport",
  },
  {
    label: "ডিসকাউন্ট রিপোর্ট",
    path: "/discount-report",
    icon: Tag,
    description: "প্রদত্ত ছাড়ের হিসাব",
    color: "violet",
    permission: "discountReport",
  },
];

const colorMap = {
  emerald: {
    ring: "group-hover:ring-emerald-100",
    iconBox: "bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100 group-hover:border-emerald-200",
    icon: "text-emerald-500",
    label: "group-hover:text-emerald-900",
    desc: "group-hover:text-emerald-500",
    bar: "from-emerald-500 to-emerald-400",
  },
  indigo: {
    ring: "group-hover:ring-indigo-100",
    iconBox: "bg-indigo-50 border-indigo-100 group-hover:bg-indigo-100 group-hover:border-indigo-200",
    icon: "text-indigo-500",
    label: "group-hover:text-indigo-900",
    desc: "group-hover:text-indigo-500",
    bar: "from-indigo-500 to-indigo-400",
  },
  rose: {
    ring: "group-hover:ring-rose-100",
    iconBox: "bg-rose-50 border-rose-100 group-hover:bg-rose-100 group-hover:border-rose-200",
    icon: "text-rose-500",
    label: "group-hover:text-rose-900",
    desc: "group-hover:text-rose-500",
    bar: "from-rose-500 to-rose-400",
  },
  amber: {
    ring: "group-hover:ring-amber-100",
    iconBox: "bg-amber-50 border-amber-100 group-hover:bg-amber-100 group-hover:border-amber-200",
    icon: "text-amber-600",
    label: "group-hover:text-amber-900",
    desc: "group-hover:text-amber-600",
    bar: "from-amber-500 to-amber-400",
  },
  sky: {
    ring: "group-hover:ring-sky-100",
    iconBox: "bg-sky-50 border-sky-100 group-hover:bg-sky-100 group-hover:border-sky-200",
    icon: "text-sky-500",
    label: "group-hover:text-sky-900",
    desc: "group-hover:text-sky-500",
    bar: "from-sky-500 to-sky-400",
  },
  violet: {
    ring: "group-hover:ring-violet-100",
    iconBox: "bg-violet-50 border-violet-100 group-hover:bg-violet-100 group-hover:border-violet-200",
    icon: "text-violet-500",
    label: "group-hover:text-violet-900",
    desc: "group-hover:text-violet-500",
    bar: "from-violet-500 to-violet-400",
  },
};

const DailyReport = () => {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const permissions = useAuthStore((s) => s.user?.permissions);
  const isAdmin = role === "admin";

  const hasAccess = (item) => isAdmin || !!permissions?.[item.permission];
  const unlockedCount = reportNav.filter(hasAccess).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,#eef2ff_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8 font-noto">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">দৈনিক রিপোর্ট</h1>
            <p className="text-[13.5px] text-slate-400 mt-0.5">
              {unlockedCount}/{reportNav.length} রিপোর্টে প্রবেশাধিকার আছে
            </p>
          </div>
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {reportNav.map((item, idx) => {
            const Icon = item.icon;
            const c = colorMap[item.color];
            const allowed = hasAccess(item);

            return (
              <button
                key={item.path}
                onClick={allowed ? () => navigate(item.path) : undefined}
                disabled={!allowed}
                title={!allowed ? "প্রবেশাধিকার নেই" : undefined}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={`group relative flex flex-col items-center gap-3 p-5 rounded-2xl border bg-white transition-all duration-200 overflow-hidden outline-none focus:outline-none hover:outline-none focus-visible:outline-none active:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 animate-[cardIn_0.4s_cubic-bezier(.22,1,.36,1)_both] ${
                  allowed
                    ? `border-slate-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 ring-1 ring-transparent ${c.ring} focus-visible:ring-indigo-400`
                    : "border-slate-100 cursor-not-allowed select-none opacity-70 saturate-0"
                }`}
              >
                {/* Persistent category rail — always visible at low opacity, brightens on hover */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                    allowed ? c.bar : "from-slate-200 to-slate-200"
                  } opacity-40 group-hover:opacity-100 transition-opacity duration-300`}
                />

                {/* Icon */}
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-[13px] border flex items-center justify-center transition-all duration-200 ${
                      allowed ? c.iconBox : "bg-slate-50 border-slate-100"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={`transition-colors duration-200 ${allowed ? c.icon : "text-slate-300"}`}
                    />
                  </div>
                  {!allowed && (
                    <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                      <Lock className="w-3 h-3 text-slate-400" strokeWidth={2.5} />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="text-center space-y-1.5">
                  <p
                    className={`text-[15.5px] font-bold tracking-tight transition-colors duration-200 leading-snug ${
                      allowed ? `text-slate-700 ${c.label}` : "text-slate-400"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p
                    className={`text-[13px] transition-colors duration-200 leading-snug ${
                      allowed ? `text-slate-400 ${c.desc}` : "text-slate-300"
                    }`}
                  >
                    {allowed ? item.description : "অনুমতি প্রয়োজন"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-\\[cardIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default DailyReport;
