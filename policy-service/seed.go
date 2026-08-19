package main

import "time"

const demoEmail = "demo@aaalife.example"

// seed loads 10-12 demo policies with due dates relative to today so the
// renewal-job visibly changes state on its first run.
func seed() {
	today := time.Now()
	day := func(offset int) string {
		return today.AddDate(0, 0, offset).Format(dateFmt)
	}

	type spec struct {
		name       string
		dob        string
		coverage   int
		term       int
		premium    float64
		status     string
		dueOffset  int // days from today; negative = overdue
		effOffset  int // days from today (effective date, in the past)
		payOffset  int // days from today for last payment; 0 means none
		bens       []Beneficiary
	}

	specs := []spec{
		// Healthy — due comfortably in the future, no action expected.
		{"Marcus Bell", "1988-03-12", 500000, 20, 62.40, "ACTIVE", 45, -320, -15,
			[]Beneficiary{{"Dana Bell", "SPOUSE", 100}}},
		{"Priya Nair", "1979-11-02", 750000, 30, 118.75, "ACTIVE", 60, -280, -5,
			[]Beneficiary{{"Arjun Nair", "SPOUSE", 60}, {"Meera Nair", "CHILD", 40}}},
		{"Tom Alvarez", "1992-07-19", 300000, 20, 41.30, "ACTIVE", 90, -200, -10,
			[]Beneficiary{{"Lucia Alvarez", "SPOUSE", 100}}},

		// Due within 7 days — expect RENEWAL_REMINDER, stays ACTIVE.
		{"Grace Kim", "1985-01-25", 600000, 20, 74.10, "ACTIVE", 3, -330, -27,
			[]Beneficiary{{"Daniel Kim", "SPOUSE", 100}}},
		{"Omar Haddad", "1990-09-08", 400000, 10, 38.90, "ACTIVE", 6, -300, -24,
			[]Beneficiary{{"Layla Haddad", "SPOUSE", 50}, {"Sami Haddad", "CHILD", 50}}},
		{"Rachel Stone", "1983-04-30", 550000, 20, 68.20, "ACTIVE", 1, -360, -29,
			[]Beneficiary{{"Ben Stone", "SPOUSE", 100}}},

		// Overdue within 30-day grace — expect move to GRACE.
		{"Victor Ruiz", "1976-12-14", 500000, 30, 96.40, "ACTIVE", -8, -400, -38,
			[]Beneficiary{{"Elena Ruiz", "SPOUSE", 100}}},
		{"Nina Patel", "1981-06-05", 350000, 20, 47.55, "ACTIVE", -20, -390, -50,
			[]Beneficiary{{"Raj Patel", "SPOUSE", 70}, {"Anaya Patel", "CHILD", 30}}},
		{"Carl Jensen", "1969-02-11", 250000, 20, 58.75, "GRACE", -25, -420, -55,
			[]Beneficiary{{"Mia Jensen", "SPOUSE", 100}}},

		// Overdue beyond 30 days — expect LAPSED.
		{"Sara Lund", "1974-08-22", 500000, 30, 101.20, "ACTIVE", -45, -430, -75,
			[]Beneficiary{{"Erik Lund", "SPOUSE", 100}}},
		{"Hank Moore", "1966-10-03", 300000, 20, 71.80, "GRACE", -60, -450, -90,
			[]Beneficiary{{"Joan Moore", "SPOUSE", 100}}},
		{"Diane Cole", "1971-05-17", 450000, 20, 82.35, "ACTIVE", -38, -410, -68,
			[]Beneficiary{{"Paul Cole", "SPOUSE", 60}, {"Amy Cole", "CHILD", 40}}},
	}

	for _, s := range specs {
		p := Policy{
			PolicyID:     newID("POL-"),
			PolicyNumber: nextPolicyNumber(),
			Applicant: Applicant{
				Name:        s.name,
				DateOfBirth: s.dob,
				Email:       demoEmail,
			},
			CoverageAmount:     s.coverage,
			TermYears:          s.term,
			MonthlyPremium:     s.premium,
			Status:             s.status,
			EffectiveDate:      day(s.effOffset),
			NextPremiumDueDate: day(s.dueOffset),
			LastPaymentDate:    day(s.payOffset),
			Beneficiaries:      s.bens,
			Notices:            []Notice{},
		}
		store[p.PolicyID] = p
	}
}
