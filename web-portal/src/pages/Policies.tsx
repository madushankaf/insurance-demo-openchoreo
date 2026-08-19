import { useState } from "react";
import { listPolicies, getPolicy, makePayment, Policy } from "../api";

const statusClass: Record<string, string> = {
  ACTIVE: "badge-active",
  GRACE: "badge-grace",
  LAPSED: "badge-lapsed",
  PENDING: "badge-pending",
};

export default function Policies() {
  const [email, setEmail] = useState("demo@aaalife.example");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    setSelected(null);
    try {
      const list = await listPolicies(email);
      list.sort((a, b) => a.policyNumber.localeCompare(b.policyNumber));
      setPolicies(list);
      setSearched(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function open(policyId: string) {
    setError("");
    try {
      setSelected(await getPolicy(policyId));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function pay(policyId: string) {
    setError("");
    try {
      const updated = await makePayment(policyId);
      setSelected(updated);
      setPolicies((list) =>
        list.map((p) => (p.policyId === policyId ? updated : p))
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>My Policies</h2>
        <form onSubmit={search} className="inline-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}

        {searched && policies.length === 0 && <p>No policies found.</p>}

        <ul className="policy-list">
          {policies.map((p) => (
            <li
              key={p.policyId}
              className={selected?.policyId === p.policyId ? "active-row" : ""}
              onClick={() => open(p.policyId)}
            >
              <div>
                <div className="policy-num">{p.policyNumber}</div>
                <div className="muted">{p.applicant.name}</div>
              </div>
              <span className={`badge ${statusClass[p.status]}`}>
                {p.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="card">
          <div className="detail-head">
            <h2>{selected.policyNumber}</h2>
            <span className={`badge ${statusClass[selected.status]}`}>
              {selected.status}
            </span>
          </div>

          <ul className="details">
            <li>
              <span>Holder</span>
              <strong>{selected.applicant.name}</strong>
            </li>
            <li>
              <span>Coverage</span>
              <strong>${selected.coverageAmount.toLocaleString()}</strong>
            </li>
            <li>
              <span>Monthly premium</span>
              <strong>${selected.monthlyPremium.toFixed(2)}</strong>
            </li>
            <li>
              <span>Effective date</span>
              <strong>{selected.effectiveDate}</strong>
            </li>
            <li>
              <span>Next premium due</span>
              <strong>{selected.nextPremiumDueDate}</strong>
            </li>
            <li>
              <span>Last payment</span>
              <strong>{selected.lastPaymentDate || "—"}</strong>
            </li>
          </ul>

          <h3>Beneficiaries</h3>
          <ul className="plain-list">
            {selected.beneficiaries.map((b, i) => (
              <li key={i}>
                {b.name} — {b.relationship} ({b.percentage}%)
              </li>
            ))}
          </ul>

          <h3>Notices</h3>
          {selected.notices.length === 0 ? (
            <p className="muted">No notices.</p>
          ) : (
            <ul className="plain-list">
              {selected.notices.map((n, i) => (
                <li key={i}>
                  <strong>{n.type}</strong> — {n.message}
                  <div className="muted">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => pay(selected.policyId)}
            disabled={selected.status === "LAPSED"}
          >
            Make a payment
          </button>
        </section>
      )}
    </div>
  );
}
