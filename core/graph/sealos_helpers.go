package graph

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
