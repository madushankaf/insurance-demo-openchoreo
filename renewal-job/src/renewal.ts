const POLICY_SERVICE_URL =
  process.env.POLICY_SERVICE_URL ?? "http://localhost:8082";

interface Notice {
  type: string;
  dueCycle: string;
}

interface Policy {
  policyId: string;
  policyNumber: string;
  status: string;
  nextPremiumDueDate: string;
  notices: Notice[];
}

export interface RunSummary {
  scanned: number;
  remindersSent: number;
  movedToGrace: number;
  lapsed: number;
}

function daysUntil(dateStr: string, today: Date): number {
  const due = new Date(dateStr + "T00:00:00Z");
  const now = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchByStatus(status: string): Promise<Policy[]> {
  const res = await fetch(
    `${POLICY_SERVICE_URL}/api/v1/policies?status=${status}`
  );
  if (!res.ok) {
    throw new Error(`failed to fetch ${status} policies: ${res.status}`);
  }
  return (await res.json()) as Policy[];
}

async function patchStatus(
  policyId: string,
  body: { status: string; type: string; message: string; dueCycle: string }
): Promise<void> {
  const res = await fetch(
    `${POLICY_SERVICE_URL}/api/v1/policies/${policyId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`failed to patch ${policyId}: ${res.status}`);
  }
}

export async function runRenewalScan(): Promise<RunSummary> {
  const today = new Date();
  const active = await fetchByStatus("ACTIVE");
  const grace = await fetchByStatus("GRACE");
  const policies = [...active, ...grace];

  const summary: RunSummary = {
    scanned: policies.length,
    remindersSent: 0,
    movedToGrace: 0,
    lapsed: 0,
  };

  for (const p of policies) {
    const days = daysUntil(p.nextPremiumDueDate, today);
    const dueCycle = p.nextPremiumDueDate; // one cycle per due date

    if (days >= 0 && days <= 7) {
      await patchStatus(p.policyId, {
        status: "ACTIVE",
        type: "RENEWAL_REMINDER",
        message: `Your premium of policy ${p.policyNumber} is due on ${p.nextPremiumDueDate}.`,
        dueCycle,
      });
      summary.remindersSent++;
    } else if (days < 0 && days >= -30) {
      await patchStatus(p.policyId, {
        status: "GRACE",
        type: "GRACE_NOTICE",
        message: `Policy ${p.policyNumber} is past due and now in a 30-day grace period.`,
        dueCycle,
      });
      summary.movedToGrace++;
    } else if (days < -30) {
      await patchStatus(p.policyId, {
        status: "LAPSED",
        type: "LAPSE_NOTICE",
        message: `Policy ${p.policyNumber} has lapsed due to non-payment beyond the grace period.`,
        dueCycle,
      });
      summary.lapsed++;
    }
  }

  return summary;
}
