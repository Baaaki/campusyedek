package rules

import (
	"time"

	"github.com/baaaki/mydreamcampus/shared/clock"
)

// GradeEditParams contains the inputs for the CanEditGrade decision.
type GradeEditParams struct {
	IsLocked         bool       // Current lock status of the score
	GlobalDeadline   time.Time  // Global grading period end date
	OverrideDeadline *time.Time // Course-specific override (nullable)
	IsAdminAction    bool       // Whether the caller is an admin
}

// GradeEditResult contains the decision and reasoning.
type GradeEditResult struct {
	Allowed           bool      `json:"allowed"`
	Reason            string    `json:"reason"`
	EffectiveDeadline time.Time `json:"effective_deadline"`
}

// CanEditGrade determines whether a grade can be modified based on the 3-layer lock model.
//
// Layer 1: Score-level lock (is_locked) — only admin can bypass
// Layer 2: Time-based deadline — effective deadline = max(global, override)
// Layer 3: Admin override — admins bypass all checks
func CanEditGrade(params GradeEditParams) GradeEditResult {
	// Calculate effective deadline
	effectiveDeadline := params.GlobalDeadline
	if params.OverrideDeadline != nil && params.OverrideDeadline.After(params.GlobalDeadline) {
		effectiveDeadline = *params.OverrideDeadline
	}

	// Admins bypass all checks
	if params.IsAdminAction {
		return GradeEditResult{
			Allowed:           true,
			Reason:            "admin action — all checks bypassed",
			EffectiveDeadline: effectiveDeadline,
		}
	}

	// Layer 1: Score-level lock
	if params.IsLocked {
		return GradeEditResult{
			Allowed:           false,
			Reason:            "score is locked — admin must unlock it first",
			EffectiveDeadline: effectiveDeadline,
		}
	}

	// Layer 2: Time-based deadline
	now := clock.Now()
	if now.After(effectiveDeadline) {
		return GradeEditResult{
			Allowed:           false,
			Reason:            "grading period has ended",
			EffectiveDeadline: effectiveDeadline,
		}
	}

	return GradeEditResult{
		Allowed:           true,
		Reason:            "within grading period and score is unlocked",
		EffectiveDeadline: effectiveDeadline,
	}
}
