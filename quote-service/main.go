package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

// Quote is a stored term-life premium quote.
type Quote struct {
	QuoteID        string    `json:"quoteId"`
	MonthlyPremium float64   `json:"monthlyPremium"`
	AnnualPremium  float64   `json:"annualPremium"`
	CoverageAmount int       `json:"coverageAmount"`
	TermYears      int       `json:"termYears"`
	Gender         string    `json:"gender"`
	HealthClass    string    `json:"healthClass"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

type quoteRequest struct {
	DateOfBirth    string `json:"dateOfBirth"`
	Gender         string `json:"gender"`
	CoverageAmount int    `json:"coverageAmount"`
	TermYears      int    `json:"termYears"`
	TobaccoUse     bool   `json:"tobaccoUse"`
	HealthClass    string `json:"healthClass"`
}

var (
	store = map[string]Quote{}
	mu    sync.Mutex
)

var healthFactors = map[string]float64{
	"PREFERRED_PLUS": 0.70,
	"PREFERRED":      0.85,
	"STANDARD":       1.00,
	"SUBSTANDARD":    1.75,
}

var termFactors = map[int]float64{
	10: 0.85,
	20: 1.00,
	30: 1.35,
}

func baseRate(age int, gender string) (float64, bool) {
	bands := []struct {
		lo, hi int
		m, f   float64
	}{
		{18, 29, 0.70, 0.60},
		{30, 39, 0.90, 0.75},
		{40, 49, 1.80, 1.50},
		{50, 59, 4.50, 3.50},
		{60, 69, 11.0, 8.50},
		{70, 75, 24.0, 19.0},
	}
	for _, b := range bands {
		if age >= b.lo && age <= b.hi {
			if gender == "M" {
				return b.m, true
			}
			return b.f, true
		}
	}
	return 0, false
}

func ageFromDOB(dob, now time.Time) int {
	years := now.Year() - dob.Year()
	if now.Month() < dob.Month() || (now.Month() == dob.Month() && now.Day() < dob.Day()) {
		years--
	}
	return years
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func newID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return prefix + hex.EncodeToString(b)
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

func createQuote(w http.ResponseWriter, r *http.Request) {
	var req quoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Gender != "M" && req.Gender != "F" {
		writeErr(w, http.StatusBadRequest, "gender must be M or F")
		return
	}
	health, ok := healthFactors[req.HealthClass]
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid healthClass")
		return
	}
	term, ok := termFactors[req.TermYears]
	if !ok {
		writeErr(w, http.StatusBadRequest, "termYears must be 10, 20 or 30")
		return
	}
	if req.CoverageAmount < 50000 || req.CoverageAmount > 1000000 || req.CoverageAmount%10000 != 0 {
		writeErr(w, http.StatusBadRequest, "coverageAmount must be 50,000-1,000,000 in multiples of 10,000")
		return
	}
	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "dateOfBirth must be YYYY-MM-DD")
		return
	}
	now := time.Now()
	age := ageFromDOB(dob, now)
	if age < 18 || age > 75 {
		writeErr(w, http.StatusBadRequest, "age must be between 18 and 75")
		return
	}
	base, ok := baseRate(age, req.Gender)
	if !ok {
		writeErr(w, http.StatusBadRequest, "no rate available for age")
		return
	}

	tobacco := 1.0
	if req.TobaccoUse {
		tobacco = 2.50
	}

	annual := base*health*tobacco*term*(float64(req.CoverageAmount)/1000.0) + 60.0
	monthly := (annual / 12.0) * 1.04

	q := Quote{
		QuoteID:        newID("QTE-"),
		MonthlyPremium: round2(monthly),
		AnnualPremium:  round2(annual),
		CoverageAmount: req.CoverageAmount,
		TermYears:      req.TermYears,
		Gender:         req.Gender,
		HealthClass:    req.HealthClass,
		ExpiresAt:      now.Add(30 * 24 * time.Hour),
	}

	mu.Lock()
	store[q.QuoteID] = q
	mu.Unlock()

	writeJSON(w, http.StatusCreated, q)
}

func getQuote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("quoteId")
	mu.Lock()
	q, ok := store[id]
	mu.Unlock()
	if !ok || time.Now().After(q.ExpiresAt) {
		writeErr(w, http.StatusNotFound, "quote not found or expired")
		return
	}
	writeJSON(w, http.StatusOK, q)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/quotes", createQuote)
	mux.HandleFunc("GET /api/v1/quotes/{quoteId}", getQuote)
	mux.HandleFunc("GET /healthz", healthz)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("quote-service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, cors(mux)); err != nil {
		log.Fatal(err)
	}
}
