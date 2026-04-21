package admin

import "strings"

// joinClauses joins SQL SET clauses with commas.
func joinClauses(clauses []string) string {
	return strings.Join(clauses, ", ")
}
