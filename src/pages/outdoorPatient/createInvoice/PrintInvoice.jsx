/**
 * useCallback / useMemo are intentionally absent throughout this file.
 * babel-plugin-react-compiler handles all memoization automatically.
 */
import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Printer, Download, Phone, Mail, MapPin, Share2, Wallet, CheckCircle } from "lucide-react";
import QRCode from "qrcode";
import { pdf, Document, Page, View, Text, Image, StyleSheet, Link, Svg, Path } from "@react-pdf/renderer";
import invoiceService from "../../../api/invoice";
import { useAuthStore } from "../../../store/authStore";
import LoadingScreen from "../../../components/loadingPage";
import Popup from "../../../components/popup";

// ─── Constants ────────────────────────────────────────────────────────────────

/** LAB_INFO is derived from the auth store at runtime — see PrintInvoice component. */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(
    isNaN(Number(n)) ? 0 : Number(n),
  );

const formatDateTime = (ts) => {
  const d = new Date(ts);
  const h = d.getHours();
  return {
    date: `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`,
    time: `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")}${h >= 12 ? "PM" : "AM"}`,
  };
};

// ── Age helpers ──────────────────────────────────────────────────────────────
// Patient age is stored/sent as { years, months, days } (see CreateInvoice.jsx
// and invoiceRoutes.js). Format it into a compact single string here —
// "24years 5months 10days" — skipping any zero/blank part. Also tolerates the
// legacy shape (a bare number/string, from invoices created before this
// change) by falling back to "<n> years".
const formatAge = (age) => {
  if (age === null || age === undefined || age === "") return "N/A";

  // Legacy shape: a plain number or numeric string.
  if (typeof age === "number" || typeof age === "string") {
    return `${age} years`;
  }

  // Current shape: { years, months, days }.
  const years = parseInt(age.years, 10) || 0;
  const months = parseInt(age.months, 10) || 0;
  const days = parseInt(age.days, 10) || 0;
  const parts = [];
  if (years > 0) parts.push(`${years}years`);
  if (months > 0) parts.push(`${months}months`);
  if (days > 0) parts.push(`${days}days`);
  return parts.length > 0 ? parts.join(" ") : "0years";
};

/** Normalise raw data from either router state or API response into a consistent shape. */
const normaliseInvoice = (raw) => ({
  invoiceId: raw.invoiceId || "",
  createdAt: raw.createdAt || Date.now(),
  patient: {
    name: raw.patient?.name || "N/A",
    gender: raw.patient?.gender || "N/A",
    // Kept as-is (object or legacy number/string) — formatAge() handles both
    // shapes at display time, in both the HTML card and the PDF.
    age: raw.patient?.age ?? null,
    contactNumber: raw.patient?.contactNumber || "N/A",
  },
  // Only field consulted for the "Doctor's Name" display — referrer is
  // never fetched or stored here since it isn't shown anywhere on this view.
  doctor: raw.doctor || null,
  tests: Array.isArray(raw.tests) ? raw.tests : [],
  products: Array.isArray(raw.products) ? raw.products : [],
  amount: {
    initial: Number(raw.amount?.initial) || 0,
    referrerDiscount: Number(raw.amount?.referrerDiscount) || 0,
    labAdjustment: Number(raw.amount?.labAdjustment) || 0,
    afterLabAdjustmentAndReferrerDiscount: Number(raw.amount?.afterLabAdjustmentAndReferrerDiscount) || 0,
    final: Number(raw.amount?.final) || 0,
    paid: Number(raw.amount?.paid) || 0,
    invoiceFee: Number(raw.amount?.invoiceFee) || 0,
  },
  reportLink: raw.reportLink || raw.link || "https://scan.labpilotpro.com",
});

// Builds the "Doctor's Name" display string — sourced only from `doctor`
// (name + degree). Referrer is never consulted for this field.
const getDoctorNameLabel = ({ doctor }) => {
  if (!doctor) return null;
  // doctor may arrive as a plain string ("Dr. Kawsar Ahmed") from some
  // invoice payloads, or as an object ({ name, degree }) from others.
  if (typeof doctor === "string") return doctor.trim() || null;
  if (!doctor.name) return null;
  return doctor.degree ? `${doctor.name}, ${doctor.degree}` : doctor.name;
};

/** Derive display flags from the normalised invoice. */
const getPricingFlags = ({ amount, doctor }) => {
  const due = Math.max(0, amount.final - amount.paid);
  const doctorNameLabel = getDoctorNameLabel({ doctor });
  // Subtotal = sum of line items (amount.initial) + the online invoice fee,
  // so it reflects everything charged before discounts/adjustments come off.
  const subtotalValue = amount.initial + amount.invoiceFee;
  return {
    showReferrerDiscount: amount.referrerDiscount > 0,
    showInvoiceFee: amount.invoiceFee > 0,
    showLabAdjustment: amount.labAdjustment > 0,
    // Show the Subtotal row whenever it would differ from the raw item sum
    // (a fee was added) or there's a deduction below it to subtotal from.
    showSubtotal: amount.referrerDiscount > 0 || amount.labAdjustment > 0 || amount.invoiceFee > 0,
    subtotalValue,
    showDoctorName: Boolean(doctorNameLabel),
    doctorNameLabel,
    due,
    isFullyPaid: due === 0,
  };
};

// Lab name can be arbitrarily long (multi-branch names, English+Bangla mixes).
// Instead of truncating with an ellipsis, shrink the font a step at a time and
// let it wrap — never crop. Sizes bumped up a step across the board (and the
// wrap width widened) so long names read bigger before they have to shrink.
// Same thresholds reused for the PDF (point sizes).
const getLabNameHtmlSizeClass = (name) => {
  const len = name?.length || 0;
  if (len > 40) return "text-lg";
  if (len > 26) return "text-xl";
  return "text-2xl";
};

const getLabNamePdfFontSize = (name) => {
  const len = name?.length || 0;
  if (len > 40) return 12;
  if (len > 26) return 14;
  return 16;
};

// ── Axios‑native network error detection (same as all other pages) ──────────
const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

// ─── PDF styles ───────────────────────────────────────────────────────────────
// Page carries the symmetric outer margin (A5 print-safe); every section below
// is inset from that shared padding instead of its own horizontal padding, so
// left/right margins stay identical all the way down the page.

const PAGE_MARGIN = 18;

const pdf$ = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000000",
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingLeft: PAGE_MARGIN,
    paddingRight: PAGE_MARGIN,
  },
  // header — centered, white bg, black text. Invoice ID / date / time no
  // longer live up here — ID moved into the patient grid, date/time moved
  // into the patient grid too — so this is now just the lab identity block.
  header: {
    alignItems: "center",
    borderBottom: "1.5 solid #e5e7eb",
    paddingBottom: 10,
  },
  // Logo sits to the left of the lab name/tagline block, both vertically
  // centered together, with the whole row centered on the page.
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoBox: {
    width: 26,
    height: 26,
    backgroundColor: "#2563eb",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  logoText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 10 },
  logoTextBlock: { alignItems: "flex-start" },
  // fontSize overridden per-invoice via getLabNamePdfFontSize; left-aligned
  // next to the logo. Wrap width widened (280 -> 340) so bigger text still
  // has room to wrap onto a second line instead of forcing a smaller size.
  labName: { color: "#000000", fontFamily: "Helvetica-Bold", textAlign: "left", maxWidth: 340, lineHeight: 1.15 },
  poweredBy: { color: "#6b7280", fontSize: 6.5, marginTop: 1, textAlign: "left" },
  labAddress: { color: "#000000", fontSize: 8, marginTop: 4, textAlign: "center" },
  labContact: { color: "#000000", fontSize: 7.5, marginTop: 2, textAlign: "center" },
  // sections — horizontal inset now comes solely from the page padding
  section: { paddingTop: 12, paddingBottom: 12, borderBottom: "1 solid #e5e7eb" },
  sectionLast: { paddingTop: 12 },
  // patient grid — three columns. Invoice ID (1/3) and Full Name (2/3) share
  // the first row. Gender / Age / Contact fill the second row together,
  // Date / Time fill the third, with Doctor's Name (when present) spanning
  // all three below that.
  patientRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  patientGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  patientField: { width: "33.33%", marginBottom: 6, paddingRight: 6 },
  patientFieldWide: { width: "66.66%", marginBottom: 6, paddingRight: 6 },
  patientFieldFull: { width: "100%", marginBottom: 6 },
  fieldInline: { fontSize: 8.5, color: "#000000" },
  fieldLabelLine: { fontFamily: "Helvetica", fontSize: 8.5, color: "#000000" },
  fieldValueLine: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#000000" },
  // QR — Invoice ID no longer displayed here (moved into the patient grid).
  qrContainer: { alignItems: "center", marginLeft: 16 },
  qrImage: { width: 60, height: 60 },
  qrLabel: { fontSize: 6.5, color: "#000000", textAlign: "center", marginTop: 3 },
  dlBtnWrapper: { marginTop: 6, position: "relative" },
  dlBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 5,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 10,
  },
  dlBtnInner: { flexDirection: "row", alignItems: "center" },
  dlBtnIcon: { width: 8, height: 8, marginRight: 4 },
  dlBtnOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  dlBtnText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7 },
  // table
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "5 8", borderBottom: "1 solid #e5e7eb" },
  // Row vertical padding halved (5 -> 2.5) so more test/product lines fit on
  // a single A5 page before the pricing summary gets pushed to a second page.
  // Header row above is untouched so it stays comfortably readable.
  tableRow: { flexDirection: "row", padding: "2.5 8", borderBottom: "1 solid #f3f4f6" },
  tableRowEven: { flexDirection: "row", padding: "2.5 8", borderBottom: "1 solid #f3f4f6", backgroundColor: "#fafafa" },
  colNum: { width: "8%", fontSize: 8, color: "#000000" },
  colName: { flex: 1, fontSize: 8, color: "#000000" },
  colPrice: { width: "25%", fontSize: 8, textAlign: "right", fontFamily: "Helvetica-Bold", color: "#000000" },
  colHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  // pricing
  pricingBox: { marginTop: 10, alignItems: "flex-end" },
  pricingInner: { width: 220 },
  pricingRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  pricingLabel: { fontSize: 8, color: "#000000" },
  pricingValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
  pricingNeg: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
  pricingFee: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
  pricingPaid: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
  pricingDue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
  divider: { borderTop: "1.5 solid #d1d5db", marginVertical: 5 },
  dashedDivider: { borderTop: "1 dashed #d1d5db", marginVertical: 5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#000000" },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#000000" },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
    padding: "4 8",
    backgroundColor: "#dcfce7",
    borderRadius: 4,
  },
  paidBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#000000" },
});

// ─── PDF Document ─────────────────────────────────────────────────────────────

const InvoicePDF = ({ invoice, qrCodeUrl, date, time, labInfo, hideDownloadButton = false }) => {
  const { patient, amount, tests, products, reportLink, invoiceId } = invoice;
  const flags = getPricingFlags(invoice);
  const hasProducts = products.length > 0;

  return (
    <Document>
      <Page size="A5" style={pdf$.page}>
        {/* Header — logo to the left of the lab name/tagline block */}
        <View style={pdf$.header}>
          <View style={pdf$.logoRow}>
            <View style={pdf$.logoBox}>
              <Text style={pdf$.logoText}>LP</Text>
            </View>
            <View style={pdf$.logoTextBlock}>
              <Text style={[pdf$.labName, { fontSize: getLabNamePdfFontSize(labInfo.name) }]}>{labInfo.name}</Text>
              <Text style={pdf$.poweredBy}>Powered by LabPilot Pro</Text>
            </View>
          </View>
          <Text style={pdf$.labAddress}>{labInfo.address}</Text>
          <Text style={pdf$.labContact}>
            {labInfo.phone} • {labInfo.email}
          </Text>
        </View>

        {/* Patient */}
        <View style={pdf$.section}>
          <View style={pdf$.patientRow}>
            <View style={pdf$.patientGrid}>
              <PDFField label="Invoice ID" value={invoiceId || "N/A"} style={pdf$.patientField} />
              <PDFField label="Full Name" value={patient.name} style={pdf$.patientFieldWide} />
              <PDFField label="Gender" value={patient.gender} style={pdf$.patientField} />
              <PDFField label="Age" value={formatAge(patient.age)} style={pdf$.patientField} />
              <PDFField label="Contact" value={patient.contactNumber} style={pdf$.patientField} />
              <PDFField label="Date" value={date} style={pdf$.patientField} />
              <PDFField label="Time" value={time} style={pdf$.patientField} />
              {flags.showDoctorName && (
                <PDFField label="Doctor's Name" value={flags.doctorNameLabel} style={pdf$.patientFieldFull} />
              )}
            </View>
            {qrCodeUrl && (
              <View style={pdf$.qrContainer}>
                <Image style={pdf$.qrImage} src={qrCodeUrl} />
                <Text style={pdf$.qrLabel}>Scan to download Reports</Text>
                {!hideDownloadButton && (
                  <View style={pdf$.dlBtnWrapper}>
                    <View style={pdf$.dlBtn}>
                      <View style={pdf$.dlBtnInner}>
                        <Svg style={pdf$.dlBtnIcon} viewBox="0 0 24 24">
                          <Path d="M12 16l-6-6h4V4h4v6h4l-6 6z" fill="#ffffff" />
                          <Path d="M20 18H4v2h16v-2z" fill="#ffffff" />
                        </Svg>
                        <Text style={pdf$.dlBtnText}>Click to Download Reports</Text>
                      </View>
                    </View>
                    <Link src={reportLink} style={pdf$.dlBtnOverlay}>
                      <Text> </Text>
                    </Link>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Tests & Products & Pricing */}
        <View style={pdf$.sectionLast}>
          {/* Smart header */}
          <View style={pdf$.tableHeader}>
            <Text style={[pdf$.colNum, pdf$.colHeader]}>#</Text>
            <Text style={[pdf$.colName, pdf$.colHeader]}>
              {tests.length > 0 && products.length > 0 ? "Test / Product" : tests.length > 0 ? "Test" : "Product"}
            </Text>
            <Text style={[pdf$.colPrice, pdf$.colHeader]}>Price</Text>
          </View>

          {/* Flat unified list — tests first, then products, sequentially numbered */}
          {[
            ...tests.map((t, i) => ({ n: i + 1, name: t.name, price: fmt(t.price) })),
            ...products.map((p, i) => {
              const qty = p.quantity ?? 1;
              const unitPrice = p.price ?? 0;
              return {
                n: tests.length + i + 1,
                name: qty > 1 ? `${p.name} (${qty} × ${fmt(unitPrice)})` : p.name,
                price: fmt(unitPrice * qty),
              };
            }),
          ].map((row, i) => (
            <View key={i} style={i % 2 === 0 ? pdf$.tableRow : pdf$.tableRowEven}>
              <Text style={pdf$.colNum}>{row.n}</Text>
              <Text style={pdf$.colName}>{row.name}</Text>
              <Text style={pdf$.colPrice}>{row.price}</Text>
            </View>
          ))}

          {/* Pricing summary — Online Invoice Fee, then Subtotal, then any
              deductions (Media Discount / Lab Adjustment), then Total. */}
          <View style={pdf$.pricingBox}>
            <View style={pdf$.pricingInner}>
              {flags.showInvoiceFee && (
                <PDFPricingRow
                  label="Online Report Fee"
                  value={`+ ${fmt(amount.invoiceFee)}`}
                  valueStyle={pdf$.pricingFee}
                />
              )}
              {flags.showSubtotal && (
                <PDFPricingRow label="Subtotal" value={fmt(flags.subtotalValue)} valueStyle={pdf$.pricingValue} />
              )}
              {flags.showReferrerDiscount && (
                <PDFPricingRow
                  label="Media Discount"
                  value={`- ${fmt(amount.referrerDiscount)}`}
                  valueStyle={pdf$.pricingNeg}
                />
              )}
              {flags.showLabAdjustment && (
                <PDFPricingRow
                  label="Lab Adjustment"
                  value={`- ${fmt(amount.labAdjustment)}`}
                  valueStyle={pdf$.pricingNeg}
                />
              )}
              <View style={pdf$.divider} />
              <View style={pdf$.totalRow}>
                <Text style={pdf$.totalLabel}>Total Amount</Text>
                <Text style={pdf$.totalValue}>{fmt(amount.final)}</Text>
              </View>
              <View style={pdf$.dashedDivider} />
              <PDFPricingRow label="Paid Amount" value={fmt(amount.paid)} valueStyle={pdf$.pricingPaid} />
              {!flags.isFullyPaid && (
                <PDFPricingRow label="Due Amount" value={fmt(flags.due)} valueStyle={pdf$.pricingDue} />
              )}
              {flags.isFullyPaid && (
                <View style={pdf$.paidBadge}>
                  <Text style={pdf$.paidBadgeText}>✓ FULLY PAID</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// Small stateless helpers used only inside the PDF
const PDFField = ({ label, value, style }) => (
  <View style={style}>
    <Text style={pdf$.fieldInline}>
      <Text style={pdf$.fieldLabelLine}>{label}: </Text>
      <Text style={pdf$.fieldValueLine}>{value}</Text>
    </Text>
  </View>
);

const PDFPricingRow = ({ label, value, valueStyle }) => (
  <View style={pdf$.pricingRow}>
    <Text style={pdf$.pricingLabel}>{label}</Text>
    <Text style={valueStyle}>{value}</Text>
  </View>
);

// ─── Invoice screen card ──────────────────────────────────────────────────────

const InvoiceCard = ({ invoice, qrCodeUrl, date, time, labInfo }) => {
  const { patient, amount, tests, products, reportLink, invoiceId } = invoice;
  const flags = getPricingFlags(invoice);
  const hasProducts = products.length > 0;

  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
      {/* Header — logo to the left of the lab name/tagline block */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex flex-col items-center text-center">
        <div className="flex flex-row items-center justify-center gap-2.5 mb-2">
          <div className="w-10 h-10 shrink-0 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">LP</span>
          </div>
          {/* max-w widened so the bigger name row has room to wrap before shrinking */}
          <div className="text-left max-w-md">
            <h1 className={`font-bold text-black leading-tight break-words ${getLabNameHtmlSizeClass(labInfo.name)}`}>
              {labInfo.name}
            </h1>
            <p className="text-gray-500 text-[10px] leading-tight">Powered by LabPilot Pro</p>
          </div>
        </div>
        <div className="mt-1 space-y-1 text-black text-xs">
          <div className="flex items-center justify-center gap-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>{labInfo.address}</span>
          </div>
          <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{labInfo.phone}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 shrink-0" />
              <span>{labInfo.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Patient — Invoice ID (1/3) and Full Name (2/3) share the first row.
          Gender / Age / Contact fill the second row together, Date / Time
          fill the third. */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-start gap-4">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2 flex-1">
            <PatientField label="Invoice ID" value={invoiceId || "N/A"} />
            <div className="col-span-2">
              <PatientField label="Full Name" value={patient.name} />
            </div>
            <PatientField label="Gender" value={<span className="capitalize">{patient.gender}</span>} />
            <PatientField label="Age" value={formatAge(patient.age)} />
            <PatientField label="Contact" value={patient.contactNumber} />
            <PatientField label="Date" value={date} />
            <PatientField label="Time" value={time} />
            {flags.showDoctorName && (
              <div className="col-span-3">
                <PatientField label="Doctor's Name" value={flags.doctorNameLabel} />
              </div>
            )}
          </div>
          {qrCodeUrl && (
            <div className="shrink-0 flex flex-col items-center gap-0.5">
              <img src={qrCodeUrl} alt="QR Code" className="w-20 h-20" />
              <p className="text-[9px] text-black text-center leading-tight">Scan to download Reports</p>
              <a
                href={reportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded-md transition-colors"
              >
                <Download className="w-2.5 h-2.5" />
                Click to Download Reports
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Tests & Products & Pricing */}
      <div className="px-6 py-4">
        {/* Unified items table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-black uppercase w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-black uppercase">
                  {tests.length > 0 && products.length > 0 ? "Test / Product" : tests.length > 0 ? "Test" : "Product"}
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-black uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ...tests.map((t, i) => ({ n: i + 1, key: t._id || `t${i}`, name: t.name, price: fmt(t.price) })),
                ...products.map((p, i) => {
                  const qty = p.quantity ?? 1;
                  const unitPrice = p.price ?? 0;
                  return {
                    n: tests.length + i + 1,
                    key: p._id || p.productId || `p${i}`,
                    name:
                      qty > 1 ? (
                        <>
                          {p.name}{" "}
                          <span className="text-black font-normal text-xs">
                            ({qty} × {fmt(unitPrice)})
                          </span>
                        </>
                      ) : (
                        p.name
                      ),
                    price: fmt(unitPrice * qty),
                  };
                }),
              ].map((row, i) => (
                <tr key={row.key} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                  <td className="px-3 py-2.5 text-xs text-black">{row.n}</td>
                  <td className="px-3 py-2.5 text-sm text-black">{row.name}</td>
                  <td className="px-3 py-2.5 text-sm text-black text-right font-medium">{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing summary — Online Invoice Fee, then Subtotal, then any
            deductions (Media Discount / Lab Adjustment), then Total. */}
        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-1.5">
            {flags.showInvoiceFee && (
              <PricingRow
                label="Online Report Fee"
                value={`+ ${fmt(amount.invoiceFee)}`}
                valueClass="font-medium text-black"
              />
            )}
            {flags.showSubtotal && <PricingRow label="Subtotal" value={fmt(flags.subtotalValue)} />}
            {flags.showReferrerDiscount && (
              <PricingRow
                label="Media Discount"
                value={`- ${fmt(amount.referrerDiscount)}`}
                valueClass="font-medium text-black"
              />
            )}
            {flags.showLabAdjustment && (
              <PricingRow
                label="Lab Adjustment"
                value={`- ${fmt(amount.labAdjustment)}`}
                valueClass="font-medium text-black"
              />
            )}
            <div className="flex justify-between pt-2 border-t-2 border-gray-200">
              <span className="text-base font-semibold text-black">Total Amount</span>
              <span className="text-lg font-bold text-black">{fmt(amount.final)}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-gray-300 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-black flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-green-600" /> Paid Amount
                </span>
                <span className="font-semibold text-black">{fmt(amount.paid)}</span>
              </div>
              {!flags.isFullyPaid && (
                <PricingRow label="Due Amount" value={fmt(flags.due)} valueClass="font-semibold text-black" />
              )}
              {flags.isFullyPaid && (
                <div className="flex items-center justify-end gap-1.5 py-1 px-2 bg-green-50 rounded-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-black text-xs font-semibold tracking-wide uppercase">Fully Paid</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small stateless helpers used only inside InvoiceCard
const PatientField = ({ label, value }) => (
  <p className="text-sm text-black leading-snug">
    <span className="text-black">{label}:</span> <span className="font-medium text-black">{value}</span>
  </p>
);

const PricingRow = ({ label, value, valueClass = "font-medium text-black" }) => (
  <div className="flex justify-between text-sm">
    <span className="text-black">{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const PrintInvoice = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const rawLab = useAuthStore((s) => s.lab);

  const labInfo = {
    name: rawLab?.name ?? "LabPilot Pro Diagnostics",
    address: rawLab?.contact?.address ?? "N/A",
    phone: rawLab?.contact?.primary ?? "N/A",
    email: rawLab?.contact?.publicEmail ?? "N/A",
  };

  const [invoice, setInvoice] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [popup, setPopup] = useState(null);
  const [offlinePopup, setOfflinePopup] = useState(false); // new

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  useEffect(() => {
    const load = async () => {
      try {
        let raw = location.state?.invoiceData ?? null;
        if (!raw) {
          if (!invoiceId) {
            setPopup({ type: "error", message: "No invoice data available" });
            setTimeout(() => navigate("/outdoor/invoice/new"), 2000);
            return;
          }
          raw = (await invoiceService.getInvoiceByInvoiceId(invoiceId)).data;
          console.log(raw);
        }
        console.log(raw);
        const normalised = normaliseInvoice(raw);
        setInvoice(normalised);

        setQrCodeUrl(
          await QRCode.toDataURL(normalised.reportLink, {
            width: 200,
            margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
          }),
        );
      } catch (err) {
        if (isNetworkError(err)) {
          setOfflinePopup(true);
        } else {
          setPopup({ type: "error", message: "Failed to load invoice data" });
        }
        setTimeout(() => navigate("/outdoor/invoice/new"), 2000);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line

  // ── PDF helpers ────────────────────────────────────────────────────────────

  // `hideDownloadButton` lets callers (print) render the PDF without the
  // "Click to Download Reports" CTA — it's a link overlay meant for on-screen
  // clicking, so it has no purpose on a physical printout. Download/Share
  // keep it since those PDFs stay digital.
  const buildPDF = ({ hideDownloadButton = false } = {}) => {
    const { date, time } = formatDateTime(invoice.createdAt);
    return pdf(
      <InvoicePDF
        invoice={invoice}
        qrCodeUrl={qrCodeUrl}
        date={date}
        time={time}
        labInfo={labInfo}
        hideDownloadButton={hideDownloadButton}
      />,
    ).toBlob();
  };

  const triggerDownload = (blob, name) => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: name, style: "display:none" }).dispatchEvent(
      new MouseEvent("click"),
    );
    URL.revokeObjectURL(url);
  };

  const pdfName = () => `Invoice-${invoice.patient.name?.replace(/\s+/g, "_") || "patient"}.pdf`;

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleDownload = async () => {
    try {
      setDownloading(true);
      triggerDownload(await buildPDF(), pdfName());
    } catch {
      setPopup({ type: "error", message: "Could not generate PDF" });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      // hideDownloadButton: true — the "Click to Download Reports" CTA is a
      // clickable link meant for an on-screen PDF; it has no purpose (and
      // shouldn't render) on a physical printout.
      const url = URL.createObjectURL(await buildPDF({ hideDownloadButton: true }));
      const iframe = Object.assign(document.createElement("iframe"), {
        src: url,
        style: "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;",
      });
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 60_000);
        }, 500);
      };
    } catch {
      setPopup({ type: "error", message: "Could not generate PDF for printing" });
    } finally {
      setPrinting(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const { date } = formatDateTime(invoice.createdAt);
      const message =
        `Hello ${invoice.patient.name},\n\n` +
        `Your diagnostic reports from ${labInfo.name} are ready!\n\n` +
        `Tests: ${invoice.tests.length} test(s)\n` +
        (invoice.products.length > 0 ? `Products: ${invoice.products.length} item(s)\n` : "") +
        `Total: ${fmt(invoice.amount.final)}\n` +
        `Date: ${date}\n\n` +
        `Download your reports here:\n${invoice.reportLink}\n\n` +
        `For queries: ${labInfo.phone}\n— ${labInfo.name}`;

      const blob = await buildPDF();
      const name = pdfName();
      const file = new File([blob], name, { type: "application/pdf" });

      if (navigator.share) {
        const canShare = navigator.canShare?.({ files: [file] });
        await navigator.share({
          title: `Invoice – ${invoice.patient.name}`,
          text: message,
          ...(canShare ? { files: [file] } : {}),
        });
        if (!canShare) triggerDownload(blob, name);
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
        triggerDownload(blob, name);
      }
    } catch (err) {
      if (err.name !== "AbortError") setPopup({ type: "error", message: "Could not share invoice" });
    } finally {
      setSharing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen message="Loading invoice..." />;
  if (!invoice) return null;

  const { date, time } = formatDateTime(invoice.createdAt);

  return (
    <>
      {popup && <Popup type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      {offlinePopup && <Popup type="offline" onClose={() => setOfflinePopup(false)} />}

      {/* Action bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="py-4 flex justify-center">
          <div className="flex items-center gap-3">
            <ActionButton
              onClick={handleShare}
              disabled={sharing}
              icon={Share2}
              label="Share"
              busy={sharing}
              busyLabel="Preparing..."
            />
            <ActionButton
              onClick={handleDownload}
              disabled={downloading}
              icon={Download}
              label="Download"
              busy={downloading}
              busyLabel="Generating..."
            />
            {!isMobile && (
              <ActionButton
                onClick={handlePrint}
                disabled={printing}
                icon={Printer}
                label="Print"
                busy={printing}
                busyLabel="Generating..."
                primary
              />
            )}
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <InvoiceCard invoice={invoice} qrCodeUrl={qrCodeUrl} date={date} time={time} labInfo={labInfo} />
        </div>
      </div>
    </>
  );
};

const ActionButton = ({ onClick, disabled, icon: Icon, label, busy, busyLabel, primary = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
      primary
        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300"
    }`}
  >
    <Icon className="w-4 h-4" />
    {busy ? busyLabel : label}
  </button>
);

export default PrintInvoice;
