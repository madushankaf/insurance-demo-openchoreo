import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createPolicy,
  Beneficiary,
  Policy,
  Quote as QuoteResult,
} from "../api";

function loadQuote(): QuoteResult | null {
  const raw = localStorage.getItem("qt_quote");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuoteResult;
  } catch {
    return null;
  }
}

const today = new Date().toISOString().slice(0, 10);

export default function Apply() {
  const navigate = useNavigate();
  const quote = useMemo(loadQuote, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@aaalife.example");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { name: "", relationship: "SPOUSE", percentage: 100 },
  ]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const total = beneficiaries.reduce(
    (sum, b) => sum + Number(b.percentage || 0),
    0
  );
  const totalsOk = total === 100;

  function updateBen(i: number, field: keyof Beneficiary, value: unknown) {
    setBeneficiaries((list) =>
      list.map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
    );
  }

  function addBen() {
    setBeneficiaries((list) => [
      ...list,
      { name: "", relationship: "CHILD", percentage: 0 },
    ]);
  }

  function removeBen(i: number) {
    setBeneficiaries((list) => list.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setError("");
    setLoading(true);
    try {
      const p = await createPolicy({
        quoteId: quote.quoteId,
        applicantName: name,
        applicantEmail: email,
        effectiveDate,
        beneficiaries: beneficiaries.map((b) => ({
          ...b,
          percentage: Number(b.percentage),
        })),
      });
      setPolicy(p);
      localStorage.removeItem("qt_quote");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!quote && !policy) {
    return (
      <div className="card">
        <h2>Apply</h2>
        <p>No active quote found.</p>
        <button onClick={() => navigate("/quote")}>Get a quote first</button>
      </div>
    );
  }

  if (policy) {
    return (
      <div className="card confirmation">
        <h2>Application Confirmed 🎉</h2>
        <p>Your term life policy is now active.</p>
        <div className="policy-number">{policy.policyNumber}</div>
        <ul className="details">
          <li>
            <span>Coverage</span>
            <strong>${policy.coverageAmount.toLocaleString()}</strong>
          </li>
          <li>
            <span>Monthly premium</span>
            <strong>${policy.monthlyPremium.toFixed(2)}</strong>
          </li>
          <li>
            <span>Effective date</span>
            <strong>{policy.effectiveDate}</strong>
          </li>
          <li>
            <span>Next premium due</span>
            <strong>{policy.nextPremiumDueDate}</strong>
          </li>
        </ul>
        <button onClick={() => navigate("/policies")}>View my policies</button>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Complete Your Application</h2>
        <form onSubmit={submit} className="form">
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Effective date
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </label>

          <h3>Beneficiaries</h3>
          {beneficiaries.map((b, i) => (
            <div className="beneficiary-row" key={i}>
              <input
                placeholder="Name"
                value={b.name}
                onChange={(e) => updateBen(i, "name", e.target.value)}
                required
              />
              <select
                value={b.relationship}
                onChange={(e) => updateBen(i, "relationship", e.target.value)}
              >
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={b.percentage}
                onChange={(e) => updateBen(i, "percentage", e.target.value)}
              />
              <span className="pct">%</span>
              {beneficiaries.length > 1 && (
                <button
                  type="button"
                  className="link"
                  onClick={() => removeBen(i)}
                >
                  remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="secondary" onClick={addBen}>
            + Add beneficiary
          </button>

          <div className={totalsOk ? "total ok" : "total bad"}>
            Total: {total}% {totalsOk ? "✓" : "(must equal 100)"}
          </div>

          <button type="submit" disabled={!totalsOk || loading}>
            {loading ? "Submitting…" : "Create policy"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card quote-result">
        <h2>Quote Summary</h2>
        <div className="premium">
          ${quote!.monthlyPremium.toFixed(2)}
          <span>/month</span>
        </div>
        <ul className="details">
          <li>
            <span>Coverage</span>
            <strong>${quote!.coverageAmount.toLocaleString()}</strong>
          </li>
          <li>
            <span>Term</span>
            <strong>{quote!.termYears} years</strong>
          </li>
          <li>
            <span>Annual premium</span>
            <strong>${quote!.annualPremium.toFixed(2)}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}
