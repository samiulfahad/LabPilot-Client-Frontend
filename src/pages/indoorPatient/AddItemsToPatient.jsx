// React Compiler active — no useCallback/useMemo
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import indoorPatientService from "../../api/indoorPatient";
import Popup from "../../components/popup";
import { useAuthStore } from "../../store/authStore";
import { Btn, ErrorMsg, PageHeader, Sk, fmt, totalExpenses, totalPayments } from "./indoorPatientHelpers";

// ─── Error helpers ───────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";

const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

// ── Network error helper ────────────────────────────────────────────────────
const isNetworkError = (error) => error?.isAxiosError === true && !error.response;

// ─── Payment modes ───────────────────────────────────────────────────────────

const PAYMENT_MODES = [
  { value: "cash", label: "ক্যাশ" },
  { value: "bkash", label: "বিকাশ" },
  { value: "nagad", label: "নগদ" },
  { value: "card", label: "কার্ড" },
  { value: "bank_transfer", label: "ব্যাংক ট্রান্সফার" },
  { value: "others", label: "অন্যান্য" },
];

// ─── Patient Search ───────────────────────────────────────────────────────────

const PatientSearch = ({ onSelect, onError, onNetworkError }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await indoorPatientService.getPatients({ status: "admitted", search: q, page: 1, limit: 20 });
      setResults(res.data.patients ?? []);
      setSearched(true);
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError?.();
        return;
      }
      setResults([]);
      setError(getErrorMessage(err, "রোগী খুঁজতে ব্যর্থ হয়েছে"));
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(val), 350);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest font-noto">ভর্তি রোগী খুঁজুন</p>
      </div>
      <div className="p-5">
        <div className="relative mb-4">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder="নাম, অ্যাডমিশন আইডি বা ফোন..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all font-noto"
          />
          {loading && (
            <svg
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        <ErrorMsg msg={error} />

        {!error && !searched && !loading && (
          <div className="text-center py-10 text-gray-300">
            <svg
              className="w-10 h-10 mx-auto mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-sm font-noto">রোগী খুঁজতে টাইপ করুন</p>
          </div>
        )}

        {!error && searched && !results.length && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm font-noto">কোনো ভর্তি রোগী পাওয়া যায়নি</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
            {results.map((p) => {
              const exp = totalExpenses(p.expenses);
              const paid = totalPayments(p.payments);
              const due = exp - paid;
              return (
                <button
                  key={p._id}
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-indigo-50/40 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black shrink-0">
                      {p.patient?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-800 font-noto">{p.patient?.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5 font-mono">
                        {p.admissionId} · {fmt.age(p.patient?.age)} · {p.space?.spaceName}
                        {p.space?.bedNumber != null ? ` · Bed ${p.space.bedNumber}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {p.dealType === "package" ? (
                      <span className="text-xs font-bold text-violet-500 bg-violet-50 px-2 py-1 rounded-lg font-noto">
                        প্যাকেজ
                      </span>
                    ) : (
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-gray-700 font-mono">{fmt.currency(exp)}</div>
                        <div className={`text-xs font-mono ${due > 0 ? "text-red-400" : "text-emerald-500"}`}>
                          {due > 0 ? `বাকি ${fmt.currency(due)}` : "পরিশোধ ✓"}
                        </div>
                      </div>
                    )}
                    <svg
                      className="w-4 h-4 text-gray-200 group-hover:text-indigo-400 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Type badge ───────────────────────────────────────────────────────────────

const TypeBadge = ({ type }) => {
  const map = {
    test: { label: "টেস্ট", cls: "bg-indigo-50 text-indigo-600" },
    medicine: { label: "ওষুধ", cls: "bg-emerald-50 text-emerald-600" },
    service: { label: "সেবা", cls: "bg-amber-50 text-amber-600" },
    other: { label: "পণ্য", cls: "bg-gray-100 text-gray-500" },
  };
  const { label, cls } = map[type] ?? map.other;
  return (
    <span
      className={`inline-block text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md font-noto ${cls}`}
    >
      {label}
    </span>
  );
};

// ─── Catalog row ──────────────────────────────────────────────────────────────

const CatalogRow = ({ type, name, price, added, disabled, onAdd }) => (
  <button
    type="button"
    disabled={disabled || added}
    onClick={onAdd}
    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-left transition-colors
      ${added ? "bg-indigo-50/60 cursor-default" : disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50 active:bg-gray-100"}`}
  >
    <TypeBadge type={type} />
    <span className={`flex-1 text-sm font-noto truncate ${added ? "text-indigo-700 font-semibold" : "text-gray-800"}`}>
      {name}
    </span>
    {disabled && (
      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 shrink-0 ml-1">
        স্টক শেষ
      </span>
    )}
    <span className="font-mono text-sm text-gray-500 shrink-0">{fmt.currency(price)}</span>
    <span
      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0
        ${added ? "bg-indigo-100 text-indigo-500" : disabled ? "text-gray-300" : "text-indigo-400"}`}
    >
      {added ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )}
    </span>
  </button>
);

// ─── Add Items Form ───────────────────────────────────────────────────────────

const AddItemsForm = ({ patient, onBack, onDone, onError, onNetworkError }) => {
  const [catalog, setCatalog] = useState({ tests: [], products: [] });
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [paidInput, setPaidInput] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isPackage = patient.dealType === "package";

  useEffect(() => {
    indoorPatientService
      .getDataForAddItem()
      .then((res) => setCatalog({ tests: res.data.tests ?? [], products: res.data.products ?? [] }))
      .catch((err) => {
        if (isNetworkError(err)) {
          onNetworkError?.();
        } else {
          setCatError(getErrorMessage(err, "তালিকা লোড করতে ব্যর্থ হয়েছে"));
        }
      })
      .finally(() => setCatLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const q = itemQuery.trim().toLowerCase();
  const filteredTests = q ? catalog.tests.filter((t) => t.name.toLowerCase().includes(q)) : [];
  const filteredProducts = q ? catalog.products.filter((p) => p.name.toLowerCase().includes(q)) : [];

  const addTest = (test) => {
    const tid = test.testId?.$oid ?? test.testId ?? null;
    if (selected.some((s) => s.itemId === tid && s.type === "test")) return;
    setSelected((prev) => [
      ...prev,
      {
        type: "test",
        itemId: tid,
        name: test.name,
        price: test.price,
        quantity: 1,
        schemaId: test.schemaId?.$oid ?? test.schemaId ?? null,
        commission: test.commission || 0,
      },
    ]);
    setItemQuery("");
  };

  const addProduct = (product) => {
    const pid = product._id?.$oid ?? product._id ?? null;
    const ptype = product.type ?? "other";
    if (selected.some((s) => s.itemId === pid && s.type === ptype)) return;
    setSelected((prev) => [
      ...prev,
      { type: ptype, itemId: pid, name: product.name, price: product.price, quantity: 1 },
    ]);
    setItemQuery("");
  };

  const removeItem = (idx) => setSelected((prev) => prev.filter((_, i) => i !== idx));
  const setQty = (idx, qty) => {
    const v = Math.max(1, parseInt(qty) || 1);
    setSelected((prev) => prev.map((s, i) => (i === idx ? { ...s, quantity: v } : s)));
  };

  const total = selected.reduce((s, i) => s + i.price * i.quantity, 0);
  const paidAmount = isPackage ? 0 : Math.min(parseFloat(paidInput) || 0, total);
  const due = total - paidAmount;

  const handlePaidChange = (e) => {
    const v = e.target.value;
    if (v === "") {
      setPaidInput("");
      return;
    }
    const num = parseFloat(v);
    if (!isNaN(num) && num > total) setPaidInput(String(total));
    else setPaidInput(v);
  };

  const handleSubmit = async () => {
    if (!selected.length) return setError("অন্তত একটি আইটেম যোগ করুন");
    setError("");
    setSubmitting(true);
    try {
      await Promise.all(
        selected.map((item) =>
          indoorPatientService.addExpense(patient._id, {
            type: item.type,
            ...(item.itemId && String(item.itemId).length === 24 ? { itemId: item.itemId } : {}),
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            ...(item.type === "test" && item.schemaId && String(item.schemaId).length === 24
              ? { schemaId: item.schemaId }
              : {}),
            ...(item.type === "test" ? { commission: item.commission || 0 } : {}),
          }),
        ),
      );
      if (!isPackage && paidAmount > 0) {
        await indoorPatientService.addPayment(patient._id, {
          amount: paidAmount,
          paymentMode,
          note: "Collected at item entry",
        });
      }
      setSuccess(true);
      setSelected([]);
      setPaidInput("");
      setPaymentMode("cash");
    } catch (err) {
      if (isNetworkError(err)) {
        onNetworkError?.();
      } else {
        setError(getErrorMessage(err, "আইটেম যোগ করতে ব্যর্থ হয়েছে"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-sm font-black text-gray-800 mb-1 font-noto">আইটেম সফলভাবে যোগ হয়েছে</h3>
        <p className="text-xs text-gray-400 mb-6 font-noto">{patient.patient?.name}-এর এক্সপেন্স রেকর্ড করা হয়েছে</p>
        <div className="flex gap-3 justify-center">
          <Btn
            variant="secondary"
            onClick={() => {
              setSuccess(false);
              onBack();
            }}
          >
            অন্য রোগী
          </Btn>
          <Btn variant="primary" onClick={onDone}>
            সম্পন্ন
          </Btn>
        </div>
      </div>
    );
  }

  const allTests = filteredTests.map((t) => {
    const tid = t.testId?.$oid ?? t.testId ?? null;
    const added = selected.some((s) => s.itemId === tid && s.type === "test");
    return (
      <CatalogRow key={t.testId} type="test" name={t.name} price={t.price} added={added} onAdd={() => addTest(t)} />
    );
  });

  const allProducts = filteredProducts.map((p) => {
    const pid = p._id?.$oid ?? p._id ?? null;
    const ptype = p.type ?? "other";
    const added = selected.some((s) => s.itemId === pid && s.type === ptype);
    const outOfStock = p.hasStock && (p.stock ?? 0) === 0;
    return (
      <CatalogRow
        key={p._id}
        type={ptype}
        name={p.name}
        price={p.price}
        added={added}
        disabled={outOfStock}
        onAdd={() => addProduct(p)}
      />
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black shrink-0">
            {patient.patient?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-gray-800 font-noto">{patient.patient?.name}</span>
              {isPackage && (
                <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg font-noto">
                  প্যাকেজ
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              {patient.admissionId} · {patient.space?.spaceName}
              {patient.space?.bedNumber != null ? ` · Bed ${patient.space.bedNumber}` : ""}
            </div>
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-indigo-500 hover:text-indigo-700 font-bold font-noto underline shrink-0"
        >
          পরিবর্তন
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest font-noto">টেস্ট ও পণ্য</p>
          {selected.length > 0 && (
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl font-mono">
              {selected.length} selected
            </span>
          )}
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="টেস্ট বা পণ্যের নাম দিয়ে খুঁজুন..."
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all font-noto"
            />
          </div>
        </div>

        {catLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Sk key={i} cls="h-11" />
            ))}
          </div>
        ) : catError ? (
          <div className="p-5">
            <ErrorMsg msg={catError} />
          </div>
        ) : !q ? (
          <div className="py-1 text-center text-gray-300"></div>
        ) : allTests.length === 0 && allProducts.length === 0 ? (
          <div className="py-10 text-center text-gray-300">
            <p className="text-sm font-noto">কোনো ফলাফল নেই</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {allTests}
            {allProducts}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest font-noto">
              নির্বাচিত ({selected.length})
            </p>
            <span className="text-sm font-black text-gray-700 font-mono">{fmt.currency(total)}</span>
          </div>

          <div className="divide-y divide-gray-100">
            {selected.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3.5">
                <TypeBadge type={item.type} />
                <span className="flex-1 text-sm text-gray-800 font-noto min-w-0 truncate">{item.name}</span>
                {item.type !== "test" ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setQty(idx, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center text-sm leading-none transition-colors"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-mono font-bold text-gray-700">{item.quantity}</span>
                    <button
                      onClick={() => setQty(idx, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center text-sm leading-none transition-colors"
                    >
                      +
                    </button>
                  </div>
                ) : null}
                <span className="text-sm font-mono text-gray-500 shrink-0 w-20 text-right">
                  {fmt.currency(item.price * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(idx)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="mx-5 my-4 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 font-noto">মোট</span>
              <span className="text-sm font-black text-gray-800 font-mono">{fmt.currency(total)}</span>
            </div>

            {isPackage ? (
              <div className="px-4 py-3 flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-violet-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs text-violet-500 font-noto">
                  প্যাকেজ ডিল — পেমেন্ট বিলিং সেকশন থেকে পরিচালিত হয়
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-4">
                  <span className="text-xs font-bold text-gray-500 font-noto shrink-0">পেমেন্ট নিন</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 font-bold">৳</span>
                    <input
                      type="number"
                      min="0"
                      max={total}
                      step="0.01"
                      placeholder="0"
                      value={paidInput}
                      onChange={handlePaidChange}
                      className="w-28 text-right py-1.5 px-2.5 border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Payment mode — mirrors CollectPaymentModal pill selector in BillingSummary.jsx */}
                {paidAmount > 0 && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-noto mb-2">
                      পেমেন্ট মাধ্যম
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PAYMENT_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setPaymentMode(mode.value)}
                          aria-pressed={paymentMode === mode.value}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-noto border transition-colors ${
                            paymentMode === mode.value
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50/50"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold text-gray-500 font-noto">বাকি</span>
                  <span className={`text-sm font-black font-mono ${due > 0 ? "text-red-400" : "text-emerald-500"}`}>
                    {due > 0 ? fmt.currency(due) : "পরিশোধ ✓"}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="px-5 pb-5 space-y-3">
            <ErrorMsg msg={error} />
            <div className="flex gap-3">
              <Btn variant="secondary" size="lg" className="flex-1" onClick={onBack}>
                বাতিল
              </Btn>
              <Btn variant="primary" size="lg" className="flex-1" loading={submitting} onClick={handleSubmit}>
                {isPackage
                  ? `${selected.length}টি আইটেম · ${fmt.currency(total)}`
                  : paidAmount > 0
                    ? `যোগ করুন ও ${fmt.currency(paidAmount)} নিন`
                    : `${selected.length}টি আইটেম · ${fmt.currency(total)}`}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {selected.length === 0 && !catLoading && !catError && (
        <p className="text-center text-xs text-gray-300 font-noto py-2">উপরের তালিকা থেকে আইটেম ট্যাপ করে যোগ করুন</p>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const AddItemsToPatient = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  // ═══════════ ফ্রন্টএন্ড পারমিশন চেক ═══════════
  const hasAccess = isAdmin || user?.permissions?.addExpenseToPatient === true;
  if (!hasAccess) {
    return <Popup type="denied" message="রোগীর টেস্ট/পণ্য যোগ করার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }
  // ════════════════════════════════════════════════

  const [searchParams] = useSearchParams();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [preloading, setPreloading] = useState(false);
  const [preloadError, setPreloadError] = useState("");
  const [popup, setPopup] = useState(null);
  const [offlinePopup, setOfflinePopup] = useState(false); // ← new

  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (!patientId) return;
    setPreloading(true);
    indoorPatientService
      .getPatient(patientId)
      .then((res) => setSelectedPatient(res.data))
      .catch((err) => {
        if (isNetworkError(err)) {
          setOfflinePopup(true);
        } else {
          setPreloadError(getErrorMessage(err, "রোগীর তথ্য লোড করতে ব্যর্থ হয়েছে"));
        }
      })
      .finally(() => setPreloading(false));
  }, []);

  const handleError = (message) => setPopup({ type: "error", message });
  const handleNetworkError = () => setOfflinePopup(true);

  const originPatientId = searchParams.get("patientId");
  const handleDone = () => (originPatientId ? navigate(`/ipd/patient/${originPatientId}`) : navigate("/ipd"));
  const handleBack = () => {
    if (originPatientId) return navigate(`/ipd/patient/${originPatientId}`);
    setSelectedPatient(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 font-noto">
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      <div className="max-w-2xl mx-auto">
        {/* Back button — same style as CollectionReport.jsx's back link.
           originPatientId is already known synchronously from the query
           string, so the destination can be computed inline as a real
           Link rather than needing handleDone's onClick logic. */}
        <div className="flex items-center justify-end mb-4">
          <Link
            to="/ipd-master"
            className="px-3 py-2 rounded-sm border border-[#1C1F1E]/15 text-[#1C1F1E] hover:bg-[#1C1F1E] hover:text-white transition-colors flex items-center gap-1.5 font-['IBM_Plex_Mono'] text-xs uppercase font-noto"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        <PageHeader
          title="টেস্ট / পণ্য যোগ করুন"
          subtitle={
            selectedPatient
              ? `${selectedPatient.patient?.name}-এর জন্য আইটেম যোগ করা হচ্ছে`
              : "প্রথমে একজন ভর্তি রোগী বেছে নিন"
          }
        />

        {preloading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Sk key={i} cls="h-16 rounded-3xl" />
            ))}
          </div>
        ) : preloadError ? (
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6">
            <ErrorMsg msg={preloadError} />
          </div>
        ) : !selectedPatient ? (
          <PatientSearch onSelect={setSelectedPatient} onError={handleError} onNetworkError={handleNetworkError} />
        ) : (
          <AddItemsForm
            patient={selectedPatient}
            onBack={handleBack}
            onDone={handleDone}
            onError={handleError}
            onNetworkError={handleNetworkError}
          />
        )}
      </div>
    </div>
  );
};

export default AddItemsToPatient;
