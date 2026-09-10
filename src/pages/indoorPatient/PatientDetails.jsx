// React Compiler active — no useCallback/useMemo
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import indoorPatientService from "../../api/indoorPatient";
import { useAuthStore } from "../../store/authStore";
import BillingSummary, { getBillingSummary } from "./BillingSummary";
import {
  BLOOD_GROUPS,
  Badge,
  BedSelector,
  Btn,
  ErrorMsg,
  Field,
  Input,
  Modal,
  PageHeader,
  SectionCard,
  Select,
  Sk,
  Textarea,
  fmt,
  totalExpenses,
  totalPayments,
} from "./indoorPatientHelpers";
import { Printer, Pencil } from "lucide-react";
import Popup from "../../components/popup";

// ─── Error helpers ──────────────────────────────────────────────────────────

const PERMISSION_DENIED_MESSAGE = "আপনার কর্তৃপক্ষ আপনাকে এই কাজটি করার বা এই তথ্যটি পাওয়ার অনুমতি দেয়নি।";
const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 403) return PERMISSION_DENIED_MESSAGE;
  return err?.response?.data?.error ?? fallback;
};

// ── Axios‑native network error detection (same as all other pages) ─────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ─── Payment modes ─────────────────────────────────────────────────────────

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "others", label: "Others" },
];

// ─── Collect Payment Modal ─────────────────────────────────────────────────

const CollectPaymentModal = ({ open, patientId, onClose, onSuccess, isExtra = false, defaultAmount = "" }) => {
  const [amount, setAmount] = useState(defaultAmount);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setPaymentMode("cash");
      setNote("");
      setError("");
    }
  }, [open, defaultAmount]);

  const handleAdd = async () => {
    setError("");
    if (!amount || parseFloat(amount) <= 0) return setError("Valid amount required");
    if (isExtra && !note.trim()) return setError("A note is required for extra payments");
    setLoading(true);
    try {
      await indoorPatientService.addPayment(patientId, {
        amount: parseFloat(amount),
        paymentMode,
        note: note.trim(),
      });
      setAmount("");
      setPaymentMode("cash");
      setNote("");
      onSuccess();
      onClose();
    } catch (err) {
      if (isNetworkError(err)) {
        setError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setError(getErrorMessage(err, "Failed to record payment"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isExtra ? "Collect Extra Payment" : "Collect Payment"} width="max-w-md">
      <div className="space-y-3">
        {isExtra && (
          <div className="px-3 py-2.5 rounded-[3px] bg-amber-50 border-l-2 border-amber-400 text-[13px] text-amber-700">
            This patient has already paid in full. Recording an additional payment.
          </div>
        )}
        <ErrorMsg msg={error} />

        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Payment Mode</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setPaymentMode(mode.value)}
                className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold border transition-colors ${
                  paymentMode === mode.value
                    ? "bg-[#0F6E5C] border-[#0F6E5C] text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-[#0F6E5C]/40 hover:bg-[#0F6E5C]/5"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (BDT)">
            <Input
              type="number"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={isExtra ? "Note (required)" : "Note (optional)"}>
            <Input
              placeholder={isExtra ? "Reason for extra payment…" : "Paid by XX / Cash / bKash"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant={isExtra ? "primary" : "success"}
            size="lg"
            className="flex-1"
            loading={loading}
            onClick={handleAdd}
          >
            {isExtra ? "Record Extra Payment" : "Record Payment"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Edit Payment Mode Modal ───────────────────────────────────────────────

const EditPaymentModeModal = ({ open, patientId, paymentId, currentMode, onClose, onSuccess }) => {
  const [paymentMode, setPaymentMode] = useState(currentMode ?? "cash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPaymentMode(currentMode ?? "cash");
      setError("");
    }
  }, [open, currentMode]);

  const handleSave = async () => {
    setError("");
    setLoading(true);
    try {
      await indoorPatientService.updatePaymentMode(patientId, paymentId, paymentMode);
      onSuccess();
      onClose();
    } catch (err) {
      if (isNetworkError(err)) {
        setError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setError(getErrorMessage(err, "Failed to update payment mode"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Payment Mode" width="max-w-md">
      <div className="space-y-4">
        <ErrorMsg msg={error} />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Payment Mode</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setPaymentMode(mode.value)}
                className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold border transition-colors ${
                  paymentMode === mode.value
                    ? "bg-[#0F6E5C] border-[#0F6E5C] text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-[#0F6E5C]/40 hover:bg-[#0F6E5C]/5"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Btn variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            size="lg"
            className="flex-1"
            loading={loading}
            disabled={paymentMode === currentMode}
            onClick={handleSave}
          >
            Save
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Tabs ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
];

// ─── Patient Detail Page ───────────────────────────────────────────────────

const PatientDetails = () => {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const lab = useAuthStore((s) => s.lab);
  const role = useAuthStore((s) => s.user?.role);
  const permissions = useAuthStore((s) => s.user?.permissions);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdmin = role === "admin";

  // ─── Permission checks ─────────────────────────────────────────────────
  const canRelease = isAdmin || !!permissions?.releasePatient;
  const canDelete = isAdmin || !!permissions?.deletePatient;
  const canAddExpense = isAdmin || !!permissions?.addExpenseToPatient;
  const canEditPatient = isAdmin || !!permissions?.editPatient;
  const canViewBilling = isAdmin || !!permissions?.patientBilling;
  const canApplyDiscount = isAdmin || !!permissions?.discount;

  const canAccessBillingTab = isAdmin || !!permissions?.patientBilling || !!permissions?.discount;

  // ─── Component state ───────────────────────────────────────────────────
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [spaces, setSpaces] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [editInfo, setEditInfo] = useState(false);
  const [editClinical, setEditClinical] = useState(false);
  const [transferWard, setTransferWard] = useState(false);
  const [changeDoc, setChangeDoc] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteNote, setDeleteNote] = useState("");
  const [showCollectPayment, setShowCollectPayment] = useState(false);
  const [showExtraPayment, setShowExtraPayment] = useState(false);
  const [editModeTarget, setEditModeTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [billingDeniedPopup, setBillingDeniedPopup] = useState(false);
  const [offlinePopup, setOfflinePopup] = useState(false); // new

  const [txForm, setTxForm] = useState({ spaceId: "", bedNumber: null, note: "" });
  const [docForm, setDocForm] = useState({ doctorId: "", note: "" });
  const [editForm, setEditForm] = useState({});
  const [clinicalForm, setClinicalForm] = useState({ description: "", medicalHistory: "" });

  // ── Deny billing tab if permission missing ──────────────────────────────
  useEffect(() => {
    if (activeTab === "billing" && !canAccessBillingTab) {
      setBillingDeniedPopup(true);
      setActiveTab("overview");
    }
  }, [activeTab, canAccessBillingTab]);

  // ── Fetch patient data ─────────────────────────────────────────────────
  const fetchPatient = async () => {
    setLoading(true);
    try {
      const res = await indoorPatientService.getPatient(patientId);
      setPatient(res.data);
      const p = res.data.patient;
      setEditForm({
        name: p.name,
        age: { years: p.age?.years ?? 0, months: p.age?.months ?? 0, days: p.age?.days ?? 0 },
        gender: p.gender,
        bloodGroup: p.bloodGroup ?? "",
        contactNumber: p.contactNumber,
        address: p.address ?? "",
        guardianName: p.guardian?.name ?? "",
        guardianRelation: p.guardian?.relation ?? "",
        guardianContact: p.guardian?.contactNumber ?? "",
      });
      setClinicalForm({
        description: res.data.disease?.description ?? "",
        medicalHistory: res.data.disease?.medicalHistory ?? "",
      });
    } catch (err) {
      if (isNetworkError(err)) {
        setOfflinePopup(true);
      }
      // If not a network error, we silently fail; the page will show "Patient not found"
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();
    indoorPatientService
      .getRequiredData()
      .then((res) => {
        setSpaces(res.data.spaces ?? []);
        setDoctors(res.data.doctors ?? []);
      })
      .catch(() => {});
  }, [patientId]);

  const setEF = (k, v) => setEditForm((f) => ({ ...f, [k]: v }));
  const setEFAge = (k, v) => setEditForm((f) => ({ ...f, age: { ...f.age, [k]: Math.max(0, parseInt(v) || 0) } }));
  const setTX = (k, v) => setTxForm((f) => ({ ...f, [k]: v }));
  const setCF = (k, v) => setClinicalForm((f) => ({ ...f, [k]: v }));

  // ── Handlers with network error detection ───────────────────────────────

  const handleSaveInfo = async () => {
    setActionError("");
    setActionLoading(true);
    try {
      await indoorPatientService.updateInfo(patientId, {
        patient: {
          name: editForm.name.trim(),
          age: {
            years: editForm.age?.years ?? 0,
            months: editForm.age?.months ?? 0,
            days: editForm.age?.days ?? 0,
          },
          gender: editForm.gender,
          bloodGroup: editForm.bloodGroup || undefined,
          contactNumber: editForm.contactNumber.trim(),
          address: editForm.address?.trim() ?? "",
          guardian: {
            name: editForm.guardianName?.trim() ?? "",
            relation: editForm.guardianRelation?.trim() ?? "",
            contactNumber: editForm.guardianContact?.trim() ?? "",
          },
        },
      });
      setEditInfo(false);
      fetchPatient();
    } catch (err) {
      if (isNetworkError(err)) {
        setActionError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setActionError(getErrorMessage(err, "Update failed"));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveClinical = async () => {
    setActionError("");
    setActionLoading(true);
    try {
      await indoorPatientService.updateClinicalNotes(patientId, {
        disease: {
          description: clinicalForm.description.trim(),
          medicalHistory: clinicalForm.medicalHistory.trim(),
        },
      });
      setEditClinical(false);
      fetchPatient();
    } catch (err) {
      if (isNetworkError(err)) {
        setActionError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setActionError(getErrorMessage(err, "Failed to update clinical notes"));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    setActionError("");
    if (!txForm.spaceId) return setActionError("Select a space");
    if (txForm.spaceId === patient.space?.spaceId) return setActionError("Patient is already in this cabin");
    const sp = spaces.find((s) => s._id === txForm.spaceId);
    if (sp?.multiBed && txForm.bedNumber == null) return setActionError("Select a bed");
    setActionLoading(true);
    try {
      await indoorPatientService.transferWard(patientId, {
        spaceId: txForm.spaceId,
        bedNumber: sp?.multiBed ? txForm.bedNumber : null,
        note: txForm.note.trim(),
      });
      setTransferWard(false);
      setTxForm({ spaceId: "", bedNumber: null, note: "" });
      fetchPatient();
    } catch (err) {
      if (isNetworkError(err)) {
        setActionError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setActionError(getErrorMessage(err, "Transfer failed"));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeDoc = async () => {
    setActionError("");
    if (!docForm.doctorId) return setActionError("Select a doctor");
    if (docForm.doctorId === patient.supervisorDoctor?.doctorId)
      return setActionError("Patient is already under this doctor");
    setActionLoading(true);
    try {
      await indoorPatientService.changeDoctor(patientId, { doctorId: docForm.doctorId, note: docForm.note });
      setChangeDoc(false);
      fetchPatient();
    } catch (err) {
      if (isNetworkError(err)) {
        setActionError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setActionError(getErrorMessage(err, "Failed to change doctor"));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    setActionLoading(true);
    try {
      await indoorPatientService.release(patientId, {});
      navigate("/ipd/patients");
    } catch (err) {
      if (isNetworkError(err)) {
        setActionError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setActionError(getErrorMessage(err, "Failed to release"));
      }
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError("");
    setActionLoading(true);
    try {
      await indoorPatientService.deletePatient(patientId, { note: deleteNote.trim() });
      navigate("/ipd/patients");
    } catch (err) {
      if (isNetworkError(err)) {
        setDeleteError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
      } else {
        setDeleteError(getErrorMessage(err, "Failed to delete patient"));
      }
      setActionLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handlePrintExpenseLog = () => {
    document.body.classList.add("print-expense-log-only");
    window.print();
  };

  const handlePrintPaymentHistory = () => {
    document.body.classList.add("print-payment-history-only");
    window.print();
  };

  useEffect(() => {
    const reset = () => {
      document.body.classList.remove("print-expense-log-only");
      document.body.classList.remove("print-payment-history-only");
    };
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  // ── Loading / Not Found / Error handling ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 font-noto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-40 h-5 bg-slate-200 rounded animate-pulse" />
              <div className="w-24 h-3.5 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Sk key={i} cls="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 font-noto flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-slate-500">Patient not found</p>
          <Btn variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/ipd")}>
            Back to IPD
          </Btn>
        </div>
      </div>
    );
  }

  const isAdmitted = patient.status === "admitted";
  const billingSummary = getBillingSummary(patient);
  const { total, paid, due } = billingSummary;
  const discount = billingSummary.totalDiscount ?? 0;
  const isPackageFullyPaid = patient.dealType === "package" && due <= 0;
  const collectDefaultAmount = due > 0 ? String(Math.ceil(due)) : "";
  const txSelectedSpace = spaces.find((s) => s._id === txForm.spaceId) ?? null;
  const transferableSpaces = spaces.filter((s) => s._id !== patient.space?.spaceId);
  const transferableDoctors = doctors.filter((d) => d._id !== patient.supervisorDoctor?.doctorId);

  const SectionLetterhead = ({ className }) => (
    <div className={`hidden text-center pt-6 px-6 pb-4 mb-3 border-b-2 border-slate-800 ${className}`}>
      <h3 className="text-xl font-bold text-slate-900 tracking-wide uppercase">{lab?.name ?? "LabPilot Pro"}</h3>
      {lab?.contact?.address && <p className="text-[11px] text-slate-500 mt-1.5">{lab.contact.address}</p>}
      {lab?.contact?.primary && <p className="text-[11px] text-slate-500 mt-0.5">{lab.contact.primary}</p>}
      <div className="flex items-center justify-center gap-2 mt-3 text-[11px] font-mono text-slate-600">
        <span className="font-bold">{patient.admissionId}</span>
        <span className="text-slate-300">·</span>
        <span>{patient.patient.name}</span>
        <span className="text-slate-300">·</span>
        <span>
          {fmt.age(patient.patient.age)} / {patient.patient.gender}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 font-noto">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #billing-printable, #billing-printable * { visibility: visible; }
          #billing-printable { position: fixed; top: 0; left: 0; width: 100%; padding: 32px; box-shadow: none; }
          .no-print { display: none !important; }

          body.print-expense-log-only #billing-printable > *:not(#expense-log-print-root) {
            display: none !important;
          }
          body.print-expense-log-only .expense-log-print-letterhead {
            display: block !important;
          }

          body.print-payment-history-only #billing-printable > *:not(#payment-history-print-root) {
            display: none !important;
          }
          body.print-payment-history-only .payment-history-print-letterhead {
            display: block !important;
          }
        }
      `}</style>

      {/* Offline popup for initial fetch failure */}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      {/* Billing denied popup */}
      {billingDeniedPopup && (
        <Popup
          type="denied"
          message="আপনার বিলিং তথ্য দেখার অনুমতি নেই।"
          onClose={() => setBillingDeniedPopup(false)}
        />
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="no-print">
          <PageHeader
            title={patient.patient.name}
            subtitle={`${patient.admissionId} · ${fmt.age(patient.patient.age)} · ${patient.patient.gender}${patient.patient.bloodGroup ? ` · ${patient.patient.bloodGroup}` : ""}`}
            back={() => navigate(-1)}
          />
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-2 mb-5 flex-wrap no-print">
          <Badge color={isAdmitted ? "blue" : "green"}>{isAdmitted ? "Admitted" : "Released"}</Badge>
          {patient.dealType === "package" && <Badge color="purple">Package Deal</Badge>}
          {isPackageFullyPaid && <Badge color="green">Fully Paid</Badge>}
          <span className="text-xs text-slate-400 font-mono ml-1">Since {fmt.date(patient.admittedAt)}</span>
        </div>

        <div className="no-print">
          <ErrorMsg msg={actionError} />
        </div>

        {/* Tabs — hide billing tab if no permission */}
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-[8px] mb-5 shadow-sm overflow-x-auto no-print">
          {TABS.filter((tab) => tab.id !== "billing" || canAccessBillingTab).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-max py-1.5 px-3 text-sm font-semibold rounded-[6px] transition-all whitespace-nowrap ${
                activeTab === t.id ? "bg-[#0F6E5C] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <SectionCard
              title="Patient Information"
              icon="👤"
              action={
                <div className="flex items-center gap-1.5">
                  {canEditPatient && (
                    <Btn variant="ghost" size="sm" onClick={() => setEditInfo(!editInfo)}>
                      {editInfo ? "Cancel" : "Edit"}
                    </Btn>
                  )}
                  {isAdmitted && canRelease && (
                    <Btn variant="danger" size="sm" onClick={() => setReleaseConfirm(true)}>
                      Discharge
                    </Btn>
                  )}
                </div>
              }
            >
              {!editInfo ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    {[
                      ["Name", patient.patient.name],
                      ["Age / Gender", `${fmt.age(patient.patient.age)} / ${patient.patient.gender}`],
                      ["Blood Group", patient.patient.bloodGroup ?? "—"],
                      ["Contact", patient.patient.contactNumber, true],
                      ["Address", patient.patient.address || "—"],
                      [
                        "Guardian",
                        patient.patient.guardian?.name
                          ? `${patient.patient.guardian.name} (${patient.patient.guardian.relation}) — ${patient.patient.guardian.contactNumber}`
                          : "—",
                      ],
                    ].map(([k, v, mono]) => (
                      <div key={k}>
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{k}</span>
                        <div className={`font-medium text-slate-700 mt-0.5 ${mono ? "font-mono text-[13px]" : ""}`}>
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  {patient.patient.updatedAt && (
                    <div className="text-[11px] text-slate-400 italic pt-1">
                      Last edited {fmt.datetime(patient.patient.updatedAt)}
                      {patient.patient.updatedBy?.name ? ` by ${patient.patient.updatedBy.name}` : ""}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name">
                      <Input value={editForm.name} onChange={(e) => setEF("name", e.target.value)} />
                    </Field>
                    <Field label="Age">
                      <div className="grid grid-cols-3 gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Years"
                          value={editForm.age?.years ?? 0}
                          onChange={(e) => setEFAge("years", e.target.value)}
                        />
                        <Input
                          type="number"
                          min="0"
                          max="11"
                          placeholder="Months"
                          value={editForm.age?.months ?? 0}
                          onChange={(e) => setEFAge("months", e.target.value)}
                        />
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          placeholder="Days"
                          value={editForm.age?.days ?? 0}
                          onChange={(e) => setEFAge("days", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field label="Gender">
                      <Select value={editForm.gender} onChange={(e) => setEF("gender", e.target.value)}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Blood Group">
                      <Select value={editForm.bloodGroup} onChange={(e) => setEF("bloodGroup", e.target.value)}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Contact">
                      <Input value={editForm.contactNumber} onChange={(e) => setEF("contactNumber", e.target.value)} />
                    </Field>
                    <Field label="Address">
                      <Input value={editForm.address} onChange={(e) => setEF("address", e.target.value)} />
                    </Field>
                    <Field label="Guardian Name">
                      <Input value={editForm.guardianName} onChange={(e) => setEF("guardianName", e.target.value)} />
                    </Field>
                    <Field label="Relation">
                      <Input
                        value={editForm.guardianRelation}
                        onChange={(e) => setEF("guardianRelation", e.target.value)}
                      />
                    </Field>
                    <Field label="Guardian Contact">
                      <Input
                        value={editForm.guardianContact}
                        onChange={(e) => setEF("guardianContact", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Btn variant="primary" loading={actionLoading} onClick={handleSaveInfo} className="w-full">
                    Save Changes
                  </Btn>
                </div>
              )}
            </SectionCard>

            <div className="grid grid-cols-2 gap-4">
              <SectionCard
                title="Ward / Bed"
                icon="🛏️"
                action={
                  isAdmitted &&
                  canEditPatient && (
                    <Btn variant="ghost" size="sm" onClick={() => setTransferWard(!transferWard)}>
                      {transferWard ? "Cancel" : "Transfer"}
                    </Btn>
                  )
                }
              >
                {!transferWard ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-slate-800">{patient.space.spaceName}</span>
                      {patient.space.bedNumber != null && (
                        <span className="font-mono text-[11px] text-slate-400">Bed #{patient.space.bedNumber}</span>
                      )}
                    </div>
                    <div className="font-mono text-[12px] text-[#0F6E5C] font-semibold">
                      {fmt.currency(patient.space.chargePerDay)} / day
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field label="New Space">
                      <Select
                        value={txForm.spaceId}
                        onChange={(e) => {
                          setTX("spaceId", e.target.value);
                          setTX("bedNumber", null);
                        }}
                      >
                        <option value="">— Select —</option>
                        {transferableSpaces.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {!transferableSpaces.length && (
                      <p className="text-[11px] text-slate-400 italic">No other cabins available to transfer to.</p>
                    )}
                    {txSelectedSpace?.multiBed && (
                      <BedSelector
                        space={txSelectedSpace}
                        value={txForm.bedNumber}
                        onChange={(b) => setTX("bedNumber", b)}
                      />
                    )}
                    <Field label="Note">
                      <Input
                        placeholder="Reason for transfer..."
                        value={txForm.note}
                        onChange={(e) => setTX("note", e.target.value)}
                      />
                    </Field>
                    <Btn variant="primary" loading={actionLoading} onClick={handleTransfer} className="w-full">
                      Confirm Transfer
                    </Btn>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Supervisor Doctor"
                icon="👨‍⚕️"
                action={
                  isAdmitted &&
                  canEditPatient && (
                    <Btn variant="ghost" size="sm" onClick={() => setChangeDoc(!changeDoc)}>
                      {changeDoc ? "Cancel" : "Change"}
                    </Btn>
                  )
                }
              >
                {!changeDoc ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="font-semibold text-slate-800">{patient.supervisorDoctor.name}</div>
                    {patient.supervisorDoctor.degree && (
                      <div className="font-mono text-[12px] text-slate-500">{patient.supervisorDoctor.degree}</div>
                    )}
                    {patient.referrer?.name && (
                      <div className="text-[11px] text-slate-400 mt-1">Referrer: {patient.referrer.name}</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field label="New Doctor">
                      <Select
                        value={docForm.doctorId}
                        onChange={(e) => setDocForm((f) => ({ ...f, doctorId: e.target.value }))}
                      >
                        <option value="">— Select —</option>
                        {transferableDoctors.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {!transferableDoctors.length && (
                      <p className="text-[11px] text-slate-400 italic">No other doctors available to assign.</p>
                    )}
                    <Field label="Note">
                      <Input
                        placeholder="Reason..."
                        value={docForm.note}
                        onChange={(e) => setDocForm((f) => ({ ...f, note: e.target.value }))}
                      />
                    </Field>
                    <Btn variant="primary" loading={actionLoading} onClick={handleChangeDoc} className="w-full">
                      Confirm Change
                    </Btn>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Clinical Notes — editable, with last-edited stamp */}
            <SectionCard
              title="Clinical Notes"
              icon="🩺"
              action={
                canEditPatient && (
                  <Btn variant="ghost" size="sm" onClick={() => setEditClinical(!editClinical)}>
                    {editClinical ? "Cancel" : "Edit"}
                  </Btn>
                )
              }
            >
              {!editClinical ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Diagnosis / Description
                    </div>
                    <p className="text-slate-700 bg-slate-50 rounded-[3px] p-3 border border-slate-100 whitespace-pre-wrap">
                      {patient.disease?.description || "—"}
                    </p>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Medical History
                    </div>
                    <p className="text-slate-700 bg-slate-50 rounded-[3px] p-3 border border-slate-100 whitespace-pre-wrap">
                      {patient.disease?.medicalHistory || "—"}
                    </p>
                  </div>
                  {patient.disease?.updatedAt && (
                    <div className="text-[11px] text-slate-400 italic pt-1">
                      Last edited {fmt.datetime(patient.disease.updatedAt)}
                      {patient.disease.updatedBy?.name ? ` by ${patient.disease.updatedBy.name}` : ""}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label="Diagnosis / Description">
                    <Textarea
                      value={clinicalForm.description}
                      onChange={(e) => setCF("description", e.target.value.slice(0, 2000))}
                      maxLength={2000}
                      placeholder="Short description of the condition..."
                    />
                    <div
                      className={`text-[11px] font-mono mt-1 text-right ${
                        clinicalForm.description.length > 1900 ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {clinicalForm.description.length}/2000
                    </div>
                  </Field>
                  <Field label="Medical History">
                    <Textarea
                      rows={4}
                      value={clinicalForm.medicalHistory}
                      onChange={(e) => setCF("medicalHistory", e.target.value.slice(0, 3000))}
                      maxLength={3000}
                      placeholder="Past illnesses, allergies, operations..."
                    />
                    <div
                      className={`text-[11px] font-mono mt-1 text-right ${
                        clinicalForm.medicalHistory.length > 2850 ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {clinicalForm.medicalHistory.length}/3000
                    </div>
                  </Field>
                  <Btn variant="primary" loading={actionLoading} onClick={handleSaveClinical} className="w-full">
                    Save Changes
                  </Btn>
                </div>
              )}
            </SectionCard>

            {/* Ward Transfer History */}
            <SectionCard title="Ward Transfer History" icon="🔄">
              {!patient.wardHistory?.length ? (
                <p className="text-slate-400 text-sm text-center py-4">No ward transfers recorded</p>
              ) : (
                <div className="space-y-1.5">
                  {patient.wardHistory.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[3px] bg-white border border-slate-200 hover:border-slate-300 transition-colors text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700">{h.fromSpaceName}</span>
                        {h.fromBedNumber != null && (
                          <span className="font-mono text-[11px] text-slate-400"> (Bed {h.fromBedNumber})</span>
                        )}
                        <span className="text-slate-300 mx-2">→</span>
                        <span className="font-semibold text-slate-700">{h.toSpaceName ?? "Discharged"}</span>
                        {h.toBedNumber != null && (
                          <span className="font-mono text-[11px] text-slate-400"> (Bed {h.toBedNumber})</span>
                        )}
                        {h.note && <div className="text-[11px] text-slate-400 italic mt-0.5">{h.note}</div>}
                      </div>
                      <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                        <div>{fmt.date(h.movedAt)}</div>
                        <div>{h.movedBy?.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Doctor Change History */}
            <SectionCard title="Doctor Change History" icon="👨‍⚕️">
              {!patient.doctorHistory?.length ? (
                <p className="text-slate-400 text-sm text-center py-4">No doctor changes recorded</p>
              ) : (
                <div className="space-y-1.5">
                  {patient.doctorHistory.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[3px] bg-white border border-slate-200 hover:border-slate-300 transition-colors text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700">{h.previousDoctorName}</span>
                        <span className="text-slate-300 mx-2">→</span>
                        <span className="font-semibold text-slate-700">{h.newDoctorName}</span>
                        {h.note && <div className="text-[11px] text-slate-400 italic mt-0.5">{h.note}</div>}
                      </div>
                      <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                        <div>{fmt.date(h.changedAt)}</div>
                        <div>{h.changedBy?.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Danger Zone — completely hidden if user lacks delete permission */}
            {canDelete && (
              <SectionCard title="Danger Zone" icon="⚠️">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Permanently remove this record from all lists and reports. This is different from Discharge — use it
                    only to correct an admission created by mistake.
                  </p>
                  <Btn variant="danger" size="sm" className="shrink-0" onClick={() => setDeleteConfirm(true)}>
                    Delete Patient
                  </Btn>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === "billing" && canAccessBillingTab && (
          <div>
            {/* Print action bar — screen only */}
            <div className="flex items-center justify-end mb-3 no-print">
              <button
                onClick={handlePrint}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-sm font-semibold shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>

            <div id="billing-printable" className="space-y-4">
              {/* Letterhead — print only, hidden on screen */}
              <div className="hidden print:block text-center pb-4 mb-2 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 tracking-wide">{lab?.name ?? "LabPilot Pro"}</h3>
                {lab?.contact?.address && <p className="text-xs text-slate-500 mt-1">{lab.contact.address}</p>}
                {lab?.contact?.primary && <p className="text-xs text-slate-500 mt-0.5">{lab.contact.primary}</p>}
                <p className="text-xs text-slate-400 mt-2 font-mono">
                  {patient.admissionId} · {patient.patient.name} · {fmt.age(patient.patient.age)} /{" "}
                  {patient.patient.gender}
                </p>
              </div>

              <BillingSummary
                patient={patient}
                lab={lab}
                onCollect={() => setShowCollectPayment(true)}
                onExtra={() => setShowExtraPayment(true)}
                onAddExpenses={() => navigate(`/ipd/add-items?patientId=${patientId}`)}
                canAddExpenses={canAddExpense}
                patientId={patientId}
                onRefresh={fetchPatient}
                canApplyDiscount={canApplyDiscount}
              />

              {/* Discount line — print + screen, only if a discount is actually present */}
              {discount > 0 && (
                <SectionCard title="Discount" icon="🏷️">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Discount applied on total billing</span>
                    <span className="font-mono font-bold text-amber-600">- {fmt.currency(discount)}</span>
                  </div>
                </SectionCard>
              )}

              {/* Expense Log — with its own scoped print button + letterhead */}
              <div id="expense-log-print-root">
                <SectionLetterhead className="expense-log-print-letterhead" />
                <SectionCard
                  title={`Expense Log (${patient.expenses?.length ?? 0})`}
                  icon="🧾"
                  action={
                    <button
                      type="button"
                      onClick={handlePrintExpenseLog}
                      title="Print expense log only"
                      className="no-print flex items-center justify-center w-6 h-6 rounded-[3px] border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-white transition-colors shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  }
                >
                  {!patient.expenses?.length ? (
                    <p className="text-slate-400 text-sm text-center py-4">No expenses recorded yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {["Type", "Item", "Price", "Qty", "Total", "Date", "By"].map((h) => (
                              <th
                                key={h}
                                className="text-left px-2 py-2 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {patient.expenses.map((e, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-2 py-2.5">
                                <Badge color="slate">{e.type}</Badge>
                              </td>
                              <td className="px-2 py-2.5 font-medium text-slate-700">{e.name}</td>
                              <td className="px-2 py-2.5 font-mono text-slate-600">{fmt.currency(e.price)}</td>
                              <td className="px-2 py-2.5 font-mono text-slate-600">{e.quantity}</td>
                              <td className="px-2 py-2.5 font-mono font-semibold text-slate-800">
                                {fmt.currency(e.total ?? e.price * e.quantity)}
                              </td>
                              <td className="px-2 py-2.5 font-mono text-slate-400 text-[11px]">
                                {fmt.date(e.addedAt)}
                              </td>
                              <td className="px-2 py-2.5 text-slate-400 text-[11px]">{e.addedBy?.name}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200">
                            <td colSpan={4} className="px-2 py-2 text-sm font-bold text-slate-600">
                              Total
                            </td>
                            <td className="px-2 py-2 text-sm font-mono font-bold text-slate-900">
                              {fmt.currency(totalExpenses(patient.expenses))}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Payment History — with its own scoped print button + letterhead */}
              <div id="payment-history-print-root">
                <SectionLetterhead className="payment-history-print-letterhead" />
                <SectionCard
                  title={`Payment History (${patient.payments?.length ?? 0})`}
                  icon="🏦"
                  action={
                    <button
                      type="button"
                      onClick={handlePrintPaymentHistory}
                      title="Print payment history only"
                      className="no-print flex items-center justify-center w-6 h-6 rounded-[3px] border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-white transition-colors shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  }
                >
                  {!patient.payments?.length ? (
                    <p className="text-slate-400 text-sm text-center py-4">No payments recorded yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(() => {
                        let runningTotal = 0;
                        return patient.payments.map((p, i) => {
                          runningTotal += p.amount;
                          const isExtraPayment = patient.dealType === "package" && runningTotal > total && p.note;
                          const canEditMode = !!p.paymentId && p.collectedBy?.id === currentUserId;
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[3px] bg-white border-l-2 border border-slate-200 ${
                                isExtraPayment ? "border-l-amber-400" : "border-l-[#0F6E5C]"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-mono text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                  <span>{fmt.currency(p.amount)}</span>
                                  {isExtraPayment && (
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600">
                                      extra
                                    </span>
                                  )}
                                  {p.mode && (
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                      {p.mode}
                                    </span>
                                  )}
                                  {canEditMode && (
                                    <button
                                      type="button"
                                      onClick={() => setEditModeTarget({ paymentId: p.paymentId, mode: p.mode })}
                                      title="Edit payment mode"
                                      className="no-print flex items-center justify-center w-5 h-5 rounded-[3px] text-slate-300 hover:text-[#0F6E5C] hover:bg-[#0F6E5C]/10 transition-colors shrink-0"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {p.collectedBy?.name} ·{" "}
                                  <span className="font-mono">{fmt.datetime(p.collectedAt)}</span>
                                  {p.note && ` · ${p.note}`}
                                  {p.modeUpdatedAt && (
                                    <span className="italic"> · mode edited {fmt.datetime(p.modeUpdatedAt)}</span>
                                  )}
                                </div>
                              </div>
                              <Badge color={isExtraPayment ? "amber" : "green"}>
                                {isExtraPayment ? "Extra" : "Collected"}
                              </Badge>
                            </div>
                          );
                        });
                      })()}
                      <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-200 text-sm font-bold">
                        <span className="text-slate-600">Total Collected</span>
                        <span className="font-mono text-[#0F6E5C]">
                          {fmt.currency(totalPayments(patient.payments))}
                        </span>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Footer note — print only */}
              <p className="hidden print:block text-center text-[11px] text-slate-400 mt-4">
                Generated on {fmt.datetime(Date.now())}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <div className="no-print">
        <CollectPaymentModal
          open={showCollectPayment}
          patientId={patientId}
          defaultAmount={collectDefaultAmount}
          onClose={() => setShowCollectPayment(false)}
          onSuccess={fetchPatient}
        />
        <CollectPaymentModal
          open={showExtraPayment}
          patientId={patientId}
          isExtra={true}
          defaultAmount=""
          onClose={() => setShowExtraPayment(false)}
          onSuccess={fetchPatient}
        />
        <EditPaymentModeModal
          open={!!editModeTarget}
          patientId={patientId}
          paymentId={editModeTarget?.paymentId}
          currentMode={editModeTarget?.mode}
          onClose={() => setEditModeTarget(null)}
          onSuccess={fetchPatient}
        />

        {canRelease && (
          <Modal
            open={releaseConfirm}
            onClose={() => setReleaseConfirm(false)}
            title="Confirm Discharge"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Discharge {patient.patient.name}?</h3>
                <p className="text-sm text-slate-500">
                  This will release the patient and free up{" "}
                  <span className="font-semibold text-slate-700">{patient.space.spaceName}</span>
                  {patient.space.bedNumber != null && <> · Bed {patient.space.bedNumber}</>}. This action cannot be
                  undone.
                </p>
              </div>
              {due > 0 && (
                <div className="px-3 py-2.5 rounded-[3px] bg-amber-50 border-l-2 border-amber-400 text-[13px] text-amber-700">
                  <span className="font-mono font-semibold">{fmt.currency(due)}</span> is still outstanding.
                </div>
              )}
              <ErrorMsg msg={actionError} />
              <div className="flex gap-3 pt-1">
                <Btn variant="secondary" size="lg" className="flex-1" onClick={() => setReleaseConfirm(false)}>
                  Cancel
                </Btn>
                <Btn variant="danger" size="lg" className="flex-1" loading={actionLoading} onClick={handleRelease}>
                  Confirm Discharge
                </Btn>
              </div>
            </div>
          </Modal>
        )}

        {canDelete && (
          <Modal
            open={deleteConfirm}
            onClose={() => {
              setDeleteConfirm(false);
              setDeleteNote("");
              setDeleteError("");
            }}
            title="Delete Patient Record"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Delete {patient.patient.name}'s record?</h3>
                <p className="text-sm text-slate-500">
                  This removes the admission from every list, report, and cash memo figure
                  {isAdmitted && (
                    <>
                      {" "}
                      and frees up <span className="font-semibold text-slate-700">{patient.space.spaceName}</span>
                      {patient.space.bedNumber != null && <> · Bed {patient.space.bedNumber}</>}
                    </>
                  )}
                  . This action cannot be undone from the app.
                </p>
              </div>
              <Field label="Reason (optional)">
                <Input
                  placeholder="e.g. duplicate admission, entered by mistake…"
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                />
              </Field>
              <ErrorMsg msg={deleteError} />
              <div className="flex gap-3 pt-1">
                <Btn
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDeleteNote("");
                    setDeleteError("");
                  }}
                >
                  Cancel
                </Btn>
                <Btn variant="danger" size="lg" className="flex-1" loading={actionLoading} onClick={handleDelete}>
                  Confirm Delete
                </Btn>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default PatientDetails;
