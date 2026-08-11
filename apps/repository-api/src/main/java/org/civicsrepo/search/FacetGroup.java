package org.civicsrepo.search;

import java.util.List;

public record FacetGroup(String field, String label, List<FacetValue> values) {}
