package org.civicsrepo.maps;

public enum CountyBusinessPatternsMeasure {
    ESTABLISHMENTS("Establishments", "establishments"),
    EMPLOYMENT("Mid-March employment", "people"),
    FIRST_QUARTER_PAYROLL("First-quarter payroll", "thousand dollars"),
    ANNUAL_PAYROLL("Annual payroll", "thousand dollars");

    private final String label;
    private final String units;

    CountyBusinessPatternsMeasure(String label, String units) {
        this.label = label;
        this.units = units;
    }

    public String label() {
        return label;
    }

    public String units() {
        return units;
    }
}
