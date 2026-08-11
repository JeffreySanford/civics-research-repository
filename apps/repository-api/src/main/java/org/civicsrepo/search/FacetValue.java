package org.civicsrepo.search;

public record FacetValue(String value, String label, long count, boolean selected) {}
