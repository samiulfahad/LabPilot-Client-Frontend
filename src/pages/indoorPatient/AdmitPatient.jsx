// React Compiler active — no useCallback/useMemo
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import indoorPatientService from "../../api/indoorPatient";
import { BLOOD_GROUPS, Btn, BedSelector, ErrorMsg, Select, Sk, Textarea } from "./indoorPatientHelpers";
import Popup from "../../components/popup";
import { useAuthStore } from "../../store/authStore";
import {
  User,
  Calendar,
  Phone,
  MapPin,
  Droplet,
  Users,
  UserCircle,
  Stethoscope,
  ClipboardList,
  BedDouble,
  Package,
  Building2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

// ─── Error helpers ───────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";

const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

// ── Network error helper ──────────────────────────────────────────────────
const isNetworkError = (error) => error?.isAxiosError === true && !error.response;

// ── Age helpers ──────────────────────────────────────────────────────────────
// Age is collected as three parts (years / months / days) and combined into
// a single compact string for display, and into a normalized object for the
// payload sent to the backend — e.g. { years: 24, months: 5, days: 10 }.
// Any part left blank/invalid is treated as 0; if every part is blank the
// result is "" (used to gate the "বয়স প্রয়োজন" validation).
const parseAgePart = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const normalizeAge = (age) => ({
  years: parseAgePart(age?.years),
  months: parseAgePart(age?.months),
  days: parseAgePart(age?.days),
});

const formatAge = (age) => {
  if (!age) return "";
  const { years, months, days } = normalizeAge(age);
  const parts = [];
  if (years > 0) parts.push(`${years} বছর`);
  if (months > 0) parts.push(`${months} মাস`);
  if (days > 0) parts.push(`${days} দিন`);
  if (parts.length === 0) {
    return age?.years === "" || age?.years === undefined ? "" : "0 বছর";
  }
  return parts.join(" ");
};

// Valid if ANY of the three parts has been typed into — matches the same
// "at least one part filled" rule used for invoices.
const isAgeFilled = (age) =>
  [age?.years, age?.months, age?.days].some((v) => v !== "" && v !== null && v !== undefined);

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULTS = {
  name: "",
  age: { years: "", months: "", days: "" },
  gender: "male",
  bloodGroup: "",
  contactNumber: "",
  address: "",
  guardianName: "",
  guardianRelation: "",
  guardianContact: "",
  description: "",
  medicalHistory: "",
  spaceId: "",
  bedNumber: null,
  doctorId: "",
  referrerId: "",
  useDoctorAsReferrer: true,
  dealType: "regular",
  packageDescription: "",
  packageAmount: "",
};

// ─── UI primitives (LabPilot design language) ─────────────────────────────────

const Field = ({ label, required, optional, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {optional && <span className="text-slate-400 text-xs ml-1">(ঐচ্ছিক)</span>}
    </label>
    {children}
  </div>
);

const IconInput = ({ icon: Icon, className = "", ...props }) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
    <input
      className={`w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm font-noto
        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${className}`}
      {...props}
    />
  </div>
);

const AgePartInput = ({ value, onChange, max, placeholder }) => (
  <input
    type="number"
    inputMode="numeric"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    min="0"
    max={max}
    placeholder={placeholder}
    className="w-full text-center py-2.5 px-2 border border-slate-300 rounded-lg text-sm font-noto
      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
  />
);

const AgeInputGroup = ({ age, onAgeChange }) => {
  const preview = formatAge(age);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <AgePartInput value={age.years} onChange={(v) => onAgeChange("years", v)} max={150} placeholder="বছর" />
          <p className="text-[10px] text-slate-400 text-center mt-1">বছর</p>
        </div>
        <div>
          <AgePartInput value={age.months} onChange={(v) => onAgeChange("months", v)} max={11} placeholder="মাস" />
          <p className="text-[10px] text-slate-400 text-center mt-1">মাস</p>
        </div>
        <div>
          <AgePartInput value={age.days} onChange={(v) => onAgeChange("days", v)} max={31} placeholder="দিন" />
          <p className="text-[10px] text-slate-400 text-center mt-1">দিন</p>
        </div>
      </div>
      {preview && (
        <p className="mt-1.5 text-xs font-medium text-blue-600 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {preview}
        </p>
      )}
    </div>
  );
};

const SectionCard = ({ icon: Icon, title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
      <div className="p-2 bg-blue-50 rounded-lg">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <h3 className="font-medium text-slate-900">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const FormSkeleton = () => (
  <div className="space-y-5">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-100 px-6 py-4 animate-pulse">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
        </div>
        <div className="p-6 space-y-4">
          <Sk cls="h-10 rounded-lg" />
          <Sk cls="h-10 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const AdmitPatient = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  // ═══════════ ফ্রন্টএন্ড পারমিশন চেক ═══════════
  const hasAccess = isAdmin || user?.permissions?.admitPatient === true;
  if (!hasAccess) {
    return <Popup type="denied" message="রোগী ভর্তি করার অনুমতি আপনার নেই।" onClose={() => navigate("/")} />;
  }
  // ════════════════════════════════════════════════

  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null); // for non-network errors
  const [offlinePopup, setOfflinePopup] = useState(false); // ← new
  const [reqData, setReqData] = useState({ spaces: [], doctors: [], referrers: [] });
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleAgeChange = (part, value) => setForm((f) => ({ ...f, age: { ...f.age, [part]: value } }));
  const selectedSpace = reqData.spaces.find((s) => s._id === form.spaceId) ?? null;

  useEffect(() => {
    indoorPatientService
      .getRequiredData()
      .then((res) => setReqData(res.data))
      .catch((err) => {
        if (isNetworkError(err)) {
          setOfflinePopup(true);
        } else {
          setReqError(getErrorMessage(err, "প্রয়োজনীয় তথ্য লোড করতে ব্যর্থ হয়েছে"));
        }
      })
      .finally(() => setReqLoading(false));
  }, []);

  // ── occupied bed numbers for the selected space ──
  const occupiedBedNumbers = selectedSpace?.multiBed
    ? [
        ...(selectedSpace.multiBedConf?.booked ?? []),
        ...(selectedSpace.multiBedConf?.reserved ?? []).map((r) => r.bedNumber),
      ]
    : [];

  const handleSubmit = async () => {
    setError("");
    if (!form.name.trim()) return setError("রোগীর নাম প্রয়োজন");
    if (!isAgeFilled(form.age)) return setError("বয়স প্রয়োজন");
    if (!form.contactNumber) return setError("মোবাইল নম্বর প্রয়োজন");
    if (!form.spaceId) return setError("ওয়ার্ড/কেবিন নির্বাচন করুন");

    const space = reqData.spaces.find((s) => s._id === form.spaceId);
    if (space && !space.multiBed && space.reserved) {
      return setError("এই স্থানটি বর্তমানে দখলকৃত। অন্য একটি নির্বাচন করুন।");
    }
    if (space?.multiBed && form.bedNumber == null) {
      return setError("বেড নির্বাচন করুন");
    }
    if (space?.multiBed && occupiedBedNumbers.includes(form.bedNumber)) {
      return setError("নির্বাচিত বেডটি ইতিমধ্যে দখলকৃত। অন্য বেড নির্বাচন করুন।");
    }

    if (!form.doctorId) return setError("তত্ত্বাবধায়ক ডাক্তার নির্বাচন করুন");
    if (form.dealType === "package" && !form.packageAmount) return setError("প্যাকেজের পরিমাণ প্রয়োজন");

    let referrerId = null,
      referrerName = null,
      referrerType = null;
    if (form.useDoctorAsReferrer) {
      const doc = reqData.doctors.find((d) => d._id === form.doctorId);
      referrerName = doc?.name ?? null;
      referrerType = "doctor";
    } else if (form.referrerId) {
      referrerId = form.referrerId;
      const ref = reqData.referrers.find((r) => r._id === form.referrerId);
      referrerName = ref?.name ?? null;
      referrerType = ref?.type ?? null;
    }

    const payload = {
      patient: {
        name: form.name.trim(),
        age: normalizeAge(form.age),
        gender: form.gender,
        bloodGroup: form.bloodGroup || undefined,
        contactNumber: form.contactNumber.trim(),
        address: form.address.trim(),
        guardian: {
          name: form.guardianName.trim(),
          relation: form.guardianRelation.trim(),
          contactNumber: form.guardianContact.trim(),
        },
      },
      spaceId: form.spaceId,
      bedNumber: space?.multiBed ? form.bedNumber : null,
      doctorId: form.doctorId,
      referrerId,
      referrerName,
      referrerType,
      disease: { description: form.description.trim(), medicalHistory: form.medicalHistory.trim() },
      dealType: form.dealType,
      packageDeal:
        form.dealType === "package"
          ? { description: form.packageDescription.trim(), totalAmount: parseFloat(form.packageAmount) }
          : undefined,
    };

    setLoading(true);
    try {
      const res = await indoorPatientService.admit(payload);
      // NOTE: assumes the admit endpoint responds with the newly created
      // admission record at res.data._id (mirrors the shape used elsewhere,
      // e.g. AddItemsToPatient's getPatient response). If your API instead
      // nests it (e.g. res.data.admission._id or res.data.patient._id),
      // update the line below to match.
      navigate(`/ipd/patient/${res.data._id}`);
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      } else {
        setError(getErrorMessage(err, "রোগী ভর্তি করতে ব্যর্থ হয়েছে"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8 font-noto">
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <UserCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">রোগী ভর্তি</h1>
              <p className="text-sm text-slate-500">নতুন ইনডোর রোগী নিবন্ধন করুন</p>
            </div>
          </div>

          <Link
            to="/ipd-master"
            className="px-3 py-2 rounded-sm border border-[#1C1F1E]/15 text-[#1C1F1E] hover:bg-[#1C1F1E] hover:text-white transition-colors flex items-center gap-1.5 font-['IBM_Plex_Mono'] text-xs uppercase font-noto shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        {reqLoading ? (
          <FormSkeleton />
        ) : reqError ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <ErrorMsg msg={reqError} />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-6"
          >
            <ErrorMsg msg={error} />

            {/* ── Patient Information ─────────────────────────────────── */}
            <SectionCard icon={UserCircle} title="রোগীর তথ্য">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="পুরো নাম" required>
                  <IconInput
                    icon={User}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="রোগীর পুরো নাম"
                  />
                </Field>

                <Field label="বয়স" required>
                  <AgeInputGroup age={form.age} onAgeChange={handleAgeChange} />
                </Field>

                <Field label="লিঙ্গ" required>
                  <div className="flex gap-2">
                    {[
                      { value: "male", label: "পুরুষ" },
                      { value: "female", label: "মহিলা" },
                      { value: "other", label: "অন্যান্য" },
                    ].map((g) => (
                      <label
                        key={g.value}
                        className={`flex-1 flex items-center justify-center py-2.5 px-2 border rounded-lg cursor-pointer transition-all text-sm font-medium select-none ${
                          form.gender === g.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={g.value}
                          checked={form.gender === g.value}
                          onChange={() => set("gender", g.value)}
                          className="sr-only"
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="ব্লাড গ্রুপ" optional>
                  <div className="relative">
                    <Droplet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                    <Select
                      className="pl-9"
                      value={form.bloodGroup}
                      onChange={(e) => set("bloodGroup", e.target.value)}
                    >
                      <option value="">— নির্বাচন করুন —</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Field>

                <Field label="মোবাইল নম্বর" required>
                  <IconInput
                    icon={Phone}
                    type="tel"
                    value={form.contactNumber}
                    onChange={(e) => set("contactNumber", e.target.value)}
                    placeholder="০১XXXXXXXXX"
                    maxLength={11}
                  />
                </Field>

                <Field label="ঠিকানা" optional>
                  <IconInput
                    icon={MapPin}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="বর্তমান ঠিকানা"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ── Guardian Information ────────────────────────────────── */}
            <SectionCard icon={Users} title="অভিভাবকের তথ্য">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field label="অভিভাবকের নাম" optional>
                  <IconInput
                    icon={User}
                    value={form.guardianName}
                    onChange={(e) => set("guardianName", e.target.value)}
                    placeholder="পুরো নাম"
                  />
                </Field>
                <Field label="সম্পর্ক" optional>
                  <IconInput
                    icon={Users}
                    value={form.guardianRelation}
                    onChange={(e) => set("guardianRelation", e.target.value)}
                    placeholder="পিতা/মাতা/স্বামী..."
                  />
                </Field>
                <Field label="মোবাইল নম্বর" optional>
                  <IconInput
                    icon={Phone}
                    value={form.guardianContact}
                    onChange={(e) => set("guardianContact", e.target.value)}
                    placeholder="০১XXXXXXXXX"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ── Clinical Information ────────────────────────────────── */}
            <SectionCard icon={Stethoscope} title="চিকিৎসা সংক্রান্ত তথ্য">
              <div className="space-y-5">
                <Field label="রোগ নির্ণয় / বিবরণ" optional>
                  <Textarea
                    placeholder="রোগের সংক্ষিপ্ত বিবরণ..."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </Field>
                <Field label="পূর্ববর্তী চিকিৎসা ইতিহাস" optional>
                  <Textarea
                    rows={4}
                    placeholder="অতীতের অসুস্থতা, এলার্জি, অপারেশন ইত্যাদি..."
                    value={form.medicalHistory}
                    onChange={(e) => set("medicalHistory", e.target.value)}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* ── Ward / Bed Allocation ────────────────────────────────── */}
            <SectionCard icon={BedDouble} title="ওয়ার্ড / বেড বরাদ্দ">
              <div className="space-y-4">
                <Field label="ওয়ার্ড / কেবিন / আইসিইউ নির্বাচন" required>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                    <Select
                      className="pl-9"
                      value={form.spaceId}
                      onChange={(e) => {
                        set("spaceId", e.target.value);
                        set("bedNumber", null);
                      }}
                    >
                      <option value="">— স্থান নির্বাচন —</option>
                      {reqData.spaces.map((s) => {
                        const isOccupied = !s.multiBed && s.reserved === true;
                        return (
                          <option key={s._id} value={s._id} disabled={isOccupied}>
                            {s.name} — ৳{s.chargePerDay}/দিন
                            {s.multiBed ? ` (${s.multiBedConf?.totalNumberOfBed}টি বেড)` : ""}
                            {isOccupied ? " — 🔒 দখলকৃত" : ""}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                </Field>

                {selectedSpace && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <BedSelector space={selectedSpace} value={form.bedNumber} onChange={(b) => set("bedNumber", b)} />
                    {!selectedSpace.multiBed && (
                      <div className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                        একক বেডের স্থান —
                        {selectedSpace.reserved ? (
                          <span className="text-red-600 font-medium">বর্তমানে দখলকৃত (অনুপলব্ধ)</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">শূন্য</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── Doctor & Referrer ────────────────────────────────────── */}
            <SectionCard icon={Stethoscope} title="চিকিৎসক দল">
              <div className="space-y-4">
                <Field label="তত্ত্বাবধায়ক ডাক্তার" required>
                  <Select value={form.doctorId} onChange={(e) => set("doctorId", e.target.value)}>
                    <option value="">— ডাক্তার নির্বাচন —</option>
                    {reqData.doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                        {d.degree ? ` (${d.degree})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div
                    onClick={() => set("useDoctorAsReferrer", !form.useDoctorAsReferrer)}
                    className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
                      form.useDoctorAsReferrer ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        form.useDoctorAsReferrer ? "translate-x-[18px]" : "translate-x-0"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-slate-700">তত্ত্বাবধায়ক ডাক্তারকেই মিডিয়া হিসেবে ব্যবহার করুন</span>
                </label>

                {!form.useDoctorAsReferrer && (
                  <Field label="মিডিয়া" optional>
                    <Select value={form.referrerId} onChange={(e) => set("referrerId", e.target.value)}>
                      <option value="">— মিডিয়া নেই —</option>
                      {reqData.referrers.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} ({r.type})
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            </SectionCard>

            {/* ── Billing Type ─────────────────────────────────────────── */}
            <SectionCard icon={Package} title="বিলিংয়ের ধরন">
              <div className="space-y-4">
                <div className="flex gap-3">
                  {[
                    { value: "regular", label: "সাধারণ (প্রতিদিন)" },
                    { value: "package", label: "প্যাকেজ ডিল" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => set("dealType", type.value)}
                      className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-all ${
                        form.dealType === type.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {form.dealType === "package" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <Field label="প্যাকেজের বিবরণ" optional>
                      <IconInput
                        icon={ClipboardList}
                        value={form.packageDescription}
                        onChange={(e) => set("packageDescription", e.target.value)}
                        placeholder="যেমন: সম্পূর্ণ অপারেশন প্যাকেজ"
                      />
                    </Field>
                    <Field label="মোট প্যাকেজ মূল্য (টাকা)" required>
                      <IconInput
                        icon={Package}
                        type="number"
                        min="0"
                        value={form.packageAmount}
                        onChange={(e) => set("packageAmount", e.target.value)}
                        placeholder="যেমন: ৫০০০০"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── Actions ──────────────────────────────────────────────── */}
            <div className="flex gap-3 justify-end">
              <Btn variant="secondary" size="lg" onClick={() => navigate("/ipd")}>
                বাতিল
              </Btn>
              <Btn variant="primary" size="lg" type="submit" loading={loading} className="flex items-center gap-2">
                <span>রোগী ভর্তি করুন</span>
                <ChevronRight className="w-4 h-4" />
              </Btn>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdmitPatient;
