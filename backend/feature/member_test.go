package feature

import "testing"

func TestValidateRoles(t *testing.T) {
	cases := []struct {
		name  string
		roles map[string][]int
		ok    bool
	}{
		{"1人ずつ", map[string][]int{"部長": {1}, "副部長": {2}, "会計": {3}}, true},
		{"2人ずつ", map[string][]int{"部長": {1, 2}, "副部長": {3, 4}, "会計": {5, 6}}, true},
		{"空席", map[string][]int{"部長": {1}, "副部長": {}, "会計": {3}}, false},
		{"3人", map[string][]int{"部長": {1}, "副部長": {2, 4, 5}, "会計": {3}}, false},
		{"役職が欠けている", map[string][]int{"部長": {1}, "副部長": {2}}, false},
		{"知らない役職", map[string][]int{"部長": {1}, "副部長": {2}, "主将": {3}}, false},
		{"兼任", map[string][]int{"部長": {1}, "副部長": {2}, "会計": {1}}, false},
		{"同じ人を2回", map[string][]int{"部長": {1, 1}, "副部長": {2}, "会計": {3}}, false},
	}
	for _, c := range cases {
		err := validateRoles(c.roles)
		if (err == nil) != c.ok {
			t.Errorf("%s: err = %v, want ok=%v", c.name, err, c.ok)
		}
	}
}
