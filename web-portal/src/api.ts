import { QUOTE_SERVICE_URL, POLICY_SERVICE_URL } from "./config";

export interface Quote {
  quoteId: string;
  monthlyPremium: number;
  annualPremium: number;
  coverageAmount: number;
  termYears: number;
  expiresAt: string;
}

export interface Beneficiary {
  name: string;
  relationship: string;
  percentage: number;
}

export interface Notice {
  type: string;
  message: string;
  createdAt: string;
  dueCycle: string;
}

export interface Policy {
  policyId: string;
  policyNumber: string;
  applicant: { name: string; dateOfBirth: string; email: string };
  coverageAmount: number;
  termYears: number;
  monthlyPremium: number;
  status: "PENDING" | "ACTIVE" | "GRACE" | "LAPSED";
  effectiveDate: string;
  nextPremiumDueDate: string;
  lastPaymentDate: string;
  beneficiaries: Beneficiary[];
  notices: Notice[];
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export interface QuoteInput {
  dateOfBirth: string;
  gender: "M" | "F";
  coverageAmount: number;
  termYears: number;
  tobaccoUse: boolean;
  healthClass: string;
}

export async function createQuote(input: QuoteInput): Promise<Quote> {
  const res = await fetch(`${QUOTE_SERVICE_URL}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<Quote>(res);
}

export interface CreatePolicyInput {
  quoteId: string;
  applicantName: string;
  applicantEmail: string;
  effectiveDate: string;
  beneficiaries: Beneficiary[];
}

export async function createPolicy(
  input: CreatePolicyInput
): Promise<Policy> {
  const res = await fetch(`${POLICY_SERVICE_URL}/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handle<Policy>(res);
}

export async function listPolicies(email: string): Promise<Policy[]> {
  const res = await fetch(
    `${POLICY_SERVICE_URL}/policies?email=${encodeURIComponent(email)}`
  );
  return handle<Policy[]>(res);
}

export async function getPolicy(policyId: string): Promise<Policy> {
  const res = await fetch(
    `${POLICY_SERVICE_URL}/policies/${policyId}`
  );
  return handle<Policy>(res);
}

export async function makePayment(policyId: string): Promise<Policy> {
  const res = await fetch(
    `${POLICY_SERVICE_URL}/policies/${policyId}/payments`,
    { method: "POST" }
  );
  return handle<Policy>(res);
}
