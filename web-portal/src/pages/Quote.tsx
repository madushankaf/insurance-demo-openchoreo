import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createQuote, Quote as QuoteResult } from "../api";

const healthClasses = [
  "PREFERRED_PLUS",
  "PREFERRED",
  "STANDARD",
  "SUBSTANDARD",
];

export default function Quote() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    dateOfBirth: "1985-06-15",
    gender: "M",
    coverageAmount: 500000,
    termYears: 20,
    tobaccoUse: false,
    healthClass: "STANDARD",
  });
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const q = await createQuote({
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as "M" | "F",
        coverageAmount: Number(form.coverageAmount),
        termYears: Number(form.termYears),
        tobaccoUse: form.tobaccoUse,
        healthClass: form.healthClass,
      });
      setQuote(q);
    } catch (err) {
      setError((err as Error).message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }

  function continueToApply() {
    if (quote) {
      localStorage.setItem("qt_quote", JSON.stringify(quote));
      navigate("/apply");
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Term Life Quote</h2>
        <form onSubmit={submit} className="form">
          <label>
            Date of birth
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
          </label>
          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          <label>
            Coverage amount
            <input
              type="number"
              min={50000}
              max={1000000}
              step={10000}
              value={form.coverageAmount}
              onChange={(e) => update("coverageAmount", e.target.value)}
            />
          </label>
          <label>
            Term (years)
            <select
              value={form.termYears}
              onChange={(e) => update("termYears", e.target.value)}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </label>
          <label>
            Health class
            <select
              value={form.healthClass}
              onChange={(e) => update("healthClass", e.target.value)}
            >
              {healthClasses.map((h) => (
                <option key={h} value={h}>
                  {h.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.tobaccoUse}
              onChange={(e) => update("tobaccoUse", e.target.checked)}
            />
            Tobacco use
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Calculating…" : "Get Quote"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {quote && (
        <section className="card quote-result">
          <h2>Your Quote</h2>
          <div className="premium">
            ${quote.monthlyPremium.toFixed(2)}
            <span>/month</span>
          </div>
          <ul className="details">
            <li>
              <span>Annual premium</span>
              <strong>${quote.annualPremium.toFixed(2)}</strong>
            </li>
            <li>
              <span>Coverage</span>
              <strong>${quote.coverageAmount.toLocaleString()}</strong>
            </li>
            <li>
              <span>Term</span>
              <strong>{quote.termYears} years</strong>
            </li>
            <li>
              <span>Expires</span>
              <strong>
                {new Date(quote.expiresAt).toLocaleDateString()}
              </strong>
            </li>
          </ul>
          <button onClick={continueToApply}>Continue to apply</button>
        </section>
      )}
    </div>
  );
}
