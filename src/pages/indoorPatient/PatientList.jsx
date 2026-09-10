// React Compiler active — no useCallback/useMemo
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import indoorPatientService from "../../api/indoorPatient";
import { Btn, EmptyState, Input, PageHeader, Sk, fmt } from "./indoorPatientHelpers";
import Popup from "../../components/popup";
import { useAuthStore } from "../../store/authStore";

// ─── Clipboard helper ──────────────────────────────────────────────────────────

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

// ─── Copy Admission ID Button ──────────────────────────────────────────────────

const CopyIdButton = ({ value }) => {
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "কপি হয়েছে" : "আইডি কপি করুন"}
      aria-label="Copy admission ID"
      className="inline-flex items-center justify-center w-4 h-4 rounded text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
    >
      {copied ? (
        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="11" height="11" rx="1.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
        </svg>
      )}
    </button>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────

const PatientRow = ({ patient }) => {
  const navigate = useNavigate();
  const isAdmitted = patient.status === "admitted";

  const goToDetail = () => navigate(`/ipd/patient/${patient._id}`);

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/40 transition-colors duration-150">
      <td className="px-4 py-3 cursor-pointer" onClick={goToDetail}>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isAdmitted ? "bg-blue-500 shadow-sm shadow-blue-200" : "bg-emerald-500 shadow-sm shadow-emerald-200"
            }`}
            title={isAdmitted ? "ভর্তি" : "রিলিজ"}
          />
          <span className="font-semibold text-sm text-slate-800">{patient.patient?.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 pl-4">
          <span>{patient.admissionId}</span>
          <CopyIdButton value={patient.admissionId} />
        </div>
        <div className="text-xs text-slate-400 pl-4">
          {fmt.age(patient.patient?.age)} ·{" "}
          {patient.patient?.gender === "male" ? "পুরুষ" : patient.patient?.gender === "female" ? "মহিলা" : "অন্যান্য"} ·{" "}
          {patient.patient?.contactNumber}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 cursor-pointer" onClick={goToDetail}>
        <div className="font-medium">{patient.space?.spaceName}</div>
        {patient.space?.bedNumber != null && (
          <div className="text-xs text-slate-400">বেড {patient.space.bedNumber}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell cursor-pointer" onClick={goToDetail}>
        {patient.supervisorDoctor?.name || "—"}
      </td>
      <td className="px-4 py-3">
        <Btn
          size="sm"
          variant="ghost"
          className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 border border-indigo-200/50 rounded-lg px-3 py-1 text-xs font-medium transition-all"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/report", { state: { admissionId: patient.admissionId } });
          }}
        >
          📋 রিপোর্ট
        </Btn>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/ipd/patient/${patient._id}`);
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50/60 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

const FILTERS = [
  { value: "admitted", label: "ভর্তি", activeClass: "bg-blue-600 text-white shadow-md shadow-blue-200" },
  { value: "released", label: "রিলিজ", activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-200" },
  { value: "all", label: "সব", activeClass: "bg-indigo-600 text-white shadow-md shadow-indigo-200" },
];

const PatientList = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const hasAccess = isAdmin || user?.permissions?.patientList === true;
  if (!hasAccess) {
    return <Popup type="denied" message="রোগীর তালিকা দেখার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }

  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("admitted");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlinePopup, setOfflinePopup] = useState(false);
  const searchTimer = useRef(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await indoorPatientService.getPatients({ status, search, page, limit: 20 });
      setPatients(res.data.patients ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setError("রোগীর তালিকা লোড করতে ব্যর্থ হয়েছে");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [status, search, page]);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 font-noto">
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      <div className="max-w-3xl mx-auto">
        {/* Header row: PageHeader + actions on the same flex line so the
           buttons align with the title's baseline instead of sitting in a
           separate row above it. */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <PageHeader title="রোগীদের তালিকা" subtitle="আইপিডি — ওয়ার্ড, বেড ও বিলিং" />

          <div className="flex items-center gap-2 shrink-0">
            <Btn
              variant="primary"
              onClick={() => navigate("/ipd/admit")}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              রোগী ভর্তি
            </Btn>
            <Link
              to="/ipd-master"
              className="px-3 py-2 rounded-sm border border-[#1C1F1E]/15 text-[#1C1F1E] hover:bg-[#1C1F1E] hover:text-white transition-colors flex items-center gap-1.5 font-['IBM_Plex_Mono'] text-xs uppercase font-noto"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/80 p-1 shadow-sm">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  status === f.value ? f.activeClass : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <Input
              className="pl-9 bg-white/80 backdrop-blur-sm border-slate-200/80 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
              placeholder="নাম, আইডি বা ফোন দিয়ে খুঁজুন..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{total} টি রেকর্ড</span>
            <Btn
              variant="ghost"
              size="sm"
              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200/50 rounded-lg px-3"
              onClick={fetchPatients}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              রিফ্রেশ
            </Btn>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/30 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Sk key={i} cls="h-16" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <Btn variant="ghost" size="sm" className="mt-3" onClick={fetchPatients}>
                আবার চেষ্টা করুন
              </Btn>
            </div>
          ) : !patients.length ? (
            <EmptyState
              icon="🏥"
              title="কোনও রোগী পাওয়া যায়নি"
              subtitle={
                search
                  ? `"${search}" এর সাথে মিল পাওয়া যায়নি`
                  : `${status === "all" ? "" : status === "admitted" ? "ভর্তি" : "রিলিজ"} রোগী নেই`
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-indigo-50/60 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider">রোগী</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                      ওয়ার্ড/বেড
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider hidden md:table-cell">
                      ডাক্তার
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                      রিপোর্ট
                    </th>
                    <th className="px-4 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <PatientRow key={p._id} patient={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <Btn
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← আগের
            </Btn>
            <span className="text-sm font-medium text-slate-600">
              পৃষ্ঠা {page} / {totalPages}
            </span>
            <Btn
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              পরের →
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientList;
