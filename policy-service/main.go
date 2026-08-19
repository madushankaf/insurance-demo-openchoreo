package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type Beneficiary struct {
	Name         string  `json:"name"`
	Relationship string  `json:"relationship"`
	Percentage   float64 `json:"percentage"`
}

type Notice struct {
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
	DueCycle  string    `json:"dueCycle"`
}

type Applicant struct {
	Name        string `json:"name"`
	DateOfBirth string `json:"dateOfBirth"`
	Email       string `json:"email"`
}

type Policy struct {
	PolicyID           string        `json:"policyId"`
	PolicyNumber       string        `json:"policyNumber"`
	Applicant          Applicant     `json:"applicant"`
	CoverageAmount     int           `json:"coverageAmount"`
	TermYears          int           `json:"termYears"`
	MonthlyPremium     float64       `json:"monthlyPremium"`
	Status             string        `json:"status"`
	EffectiveDate      string        `json:"effectiveDate"`
	NextPremiumDueDate string        `json:"nextPremiumDueDate"`
	LastPaymentDate    string        `json:"lastPaymentDate"`
	Beneficiaries      []Beneficiary `json:"beneficiaries"`
	Notices            []Notice      `json:"notices"`
}

var (
	store   = map[string]Policy{}
	mu      sync.Mutex
	polSeq  = 100
	dateFmt = "2006-01-02"
)

func quoteServiceURL() string {
	u := os.Getenv("QUOTE_SERVICE_URL")
	if u == "" {
		u = "http://localhost:8081"
	}
	return u
}

func newID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func nextPolicyNumber() string {
	polSeq++
	return fmt.Sprintf("AAL-%d-%06d", time.Now().Year(), polSeq)
}

func addMonth(d time.Time) time.Time {
	return d.AddDate(0, 1, 0)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// quoteView mirrors the fields returned by quote-service GET /api/v1/quotes/:id
type quoteView struct {
	QuoteID        string  `json:"quoteId"`
	MonthlyPremium float64 `json:"monthlyPremium"`
	CoverageAmount int     `json:"coverageAmount"`
	TermYears      int     `json:"termYears"`
}

func fetchQuote(quoteID string) (*quoteView, error) {
	resp, err := http.Get(quoteServiceURL() + "/api/v1/quotes/" + quoteID)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("quote lookup failed: status %d", resp.StatusCode)
	}
	var q quoteView
	if err := json.NewDecoder(resp.Body).Decode(&q); err != nil {
		return nil, err
	}
	return &q, nil
}

type createPolicyRequest struct {
	QuoteID        string        `json:"quoteId"`
	ApplicantName  string        `json:"applicantName"`
	ApplicantEmail string        `json:"applicantEmail"`
	EffectiveDate  string        `json:"effectiveDate"`
	Beneficiaries  []Beneficiary `json:"beneficiaries"`
}

func createPolicy(w http.ResponseWriter, r *http.Request) {
	var req createPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.QuoteID == "" || req.ApplicantEmail == "" {
		writeErr(w, http.StatusBadRequest, "quoteId and applicantEmail are required")
		return
	}
	eff, err := time.Parse(dateFmt, req.EffectiveDate)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "effectiveDate must be YYYY-MM-DD")
		return
	}
	if len(req.Beneficiaries) == 0 {
		writeErr(w, http.StatusBadRequest, "at least one beneficiary is required")
		return
	}
	total := 0.0
	for _, b := range req.Beneficiaries {
		if b.Name == "" {
			writeErr(w, http.StatusBadRequest, "beneficiary name is required")
			return
		}
		total += b.Percentage
	}
	if total != 100 {
		writeErr(w, http.StatusBadRequest, "beneficiary percentages must total 100")
		return
	}

	quote, err := fetchQuote(req.QuoteID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "quote is invalid or expired")
		return
	}

	name := req.ApplicantName
	if name == "" {
		name = "Policyholder"
	}

	p := Policy{
		PolicyID:     newID("POL-"),
		PolicyNumber: nextPolicyNumber(),
		Applicant: Applicant{
			Name:  name,
			Email: req.ApplicantEmail,
		},
		CoverageAmount:     quote.CoverageAmount,
		TermYears:          quote.TermYears,
		MonthlyPremium:     quote.MonthlyPremium,
		Status:             "ACTIVE",
		EffectiveDate:      eff.Format(dateFmt),
		NextPremiumDueDate: addMonth(eff).Format(dateFmt),
		Beneficiaries:      req.Beneficiaries,
		Notices:            []Notice{},
	}

	mu.Lock()
	store[p.PolicyID] = p
	mu.Unlock()

	writeJSON(w, http.StatusCreated, p)
}

func listPolicies(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	status := r.URL.Query().Get("status")

	mu.Lock()
	out := []Policy{}
	for _, p := range store {
		if email != "" && p.Applicant.Email != email {
			continue
		}
		if status != "" && p.Status != status {
			continue
		}
		out = append(out, p)
	}
	mu.Unlock()

	writeJSON(w, http.StatusOK, out)
}

func getPolicy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("policyId")
	mu.Lock()
	p, ok := store[id]
	mu.Unlock()
	if !ok {
		writeErr(w, http.StatusNotFound, "policy not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func makePayment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("policyId")
	mu.Lock()
	defer mu.Unlock()
	p, ok := store[id]
	if !ok {
		writeErr(w, http.StatusNotFound, "policy not found")
		return
	}
	now := time.Now()
	due, err := time.Parse(dateFmt, p.NextPremiumDueDate)
	if err != nil {
		due = now
	}
	p.LastPaymentDate = now.Format(dateFmt)
	p.NextPremiumDueDate = addMonth(due).Format(dateFmt)
	p.Status = "ACTIVE"
	store[id] = p
	writeJSON(w, http.StatusOK, p)
}

type statusRequest struct {
	Status   string `json:"status"`
	Type     string `json:"type"`
	Message  string `json:"message"`
	DueCycle string `json:"dueCycle"`
}

func updateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("policyId")
	var req statusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	mu.Lock()
	defer mu.Unlock()
	p, ok := store[id]
	if !ok {
		writeErr(w, http.StatusNotFound, "policy not found")
		return
	}

	// Idempotent per (dueCycle, type): skip if this notice already exists.
	for _, n := range p.Notices {
		if n.DueCycle == req.DueCycle && n.Type == req.Type {
			writeJSON(w, http.StatusOK, p)
			return
		}
	}

	if req.Status != "" {
		p.Status = req.Status
	}
	if req.Type != "" {
		p.Notices = append(p.Notices, Notice{
			Type:      req.Type,
			Message:   req.Message,
			CreatedAt: time.Now(),
			DueCycle:  req.DueCycle,
		})
	}
	store[id] = p
	writeJSON(w, http.StatusOK, p)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func main() {
	seed()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/policies", createPolicy)
	mux.HandleFunc("GET /api/v1/policies", listPolicies)
	mux.HandleFunc("GET /api/v1/policies/{policyId}", getPolicy)
	mux.HandleFunc("POST /api/v1/policies/{policyId}/payments", makePayment)
	mux.HandleFunc("PATCH /api/v1/policies/{policyId}/status", updateStatus)
	mux.HandleFunc("GET /healthz", healthz)

	port := "8082"
	log.Printf("policy-service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, cors(mux)); err != nil {
		log.Fatal(err)
	}
}
