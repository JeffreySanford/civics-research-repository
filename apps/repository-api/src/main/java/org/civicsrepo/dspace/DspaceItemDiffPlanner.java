package org.civicsrepo.dspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.civicsrepo.sync.SyncAction;
import org.springframework.stereotype.Component;

/**
 * Decides whether a repository item needs updating.
 *
 * <p>This previously compared whole {@link DspaceItemPayload} records for equality, which could
 * never be true: DSpace returns its own bookkeeping metadata ({@code dc.date.accessioned},
 * {@code dc.description.provenance}, and so on) that no source payload will ever contain, and the
 * reader reported an empty bitstream list against a source manifest that always had entries. So
 * {@code sync:diff} reported {@code UPDATE_ITEM} forever, which made a working diff look broken.
 *
 * <p>The comparison is now scoped to {@link DspaceManagedFields} — the fields apply actually writes
 * — so {@code SKIP_ITEM} is reachable once apply has run, and a reported difference names the
 * fields that differ instead of asserting one vaguely.
 */
@Component
public class DspaceItemDiffPlanner {
    private static final int MAX_REPORTED_FIELDS = 6;

    private final DspaceItemStateReader dspaceItemStateReader;

    public DspaceItemDiffPlanner(DspaceItemStateReader dspaceItemStateReader) {
        this.dspaceItemStateReader = dspaceItemStateReader;
    }

    public SyncAction planItemDiff(String sourceIdentifier, DspaceItemPayload sourcePayload) {
        return dspaceItemStateReader
                .findMatchingItem(sourceIdentifier, sourcePayload)
                .map((existingPayload) -> planExistingItemDiff(sourceIdentifier, sourcePayload, existingPayload))
                .orElseGet(() -> new SyncAction(
                        "CREATE_ITEM",
                        sourcePayload.name(),
                        "DSpace item does not exist for source identifier " + sourceIdentifier + "; create item with "
                                + sourcePayload.metadata().size() + " metadata fields and "
                                + sourcePayload.bitstreams().size() + " file manifest entries."));
    }

    private SyncAction planExistingItemDiff(
            String sourceIdentifier, DspaceItemPayload sourcePayload, DspaceItemPayload existingPayload) {
        List<String> differingFields = differingManagedFields(sourcePayload, existingPayload);

        if (differingFields.isEmpty()) {
            return new SyncAction(
                    "SKIP_ITEM",
                    sourcePayload.name(),
                    "DSpace item is current for source identifier " + sourceIdentifier + "; all "
                            + DspaceManagedFields.ALL.size() + " managed metadata fields match, including "
                            + sourcePayload.bitstreams().size() + " file manifest entries.");
        }

        return new SyncAction(
                "UPDATE_ITEM",
                sourcePayload.name(),
                "DSpace item exists for source identifier " + sourceIdentifier + " but "
                        + differingFields.size() + " managed field(s) differ: " + summarize(differingFields) + ".");
    }

    /** Managed fields whose source values differ from what the repository currently holds. */
    List<String> differingManagedFields(DspaceItemPayload sourcePayload, DspaceItemPayload existingPayload) {
        Map<String, List<DspaceMetadataValue>> source = new LinkedHashMap<>(sourcePayload.metadata());
        Map<String, List<DspaceMetadataValue>> existing = existingPayload.metadata();

        List<String> differing = new ArrayList<>();
        for (String field : DspaceManagedFields.ALL) {
            List<DspaceMetadataValue> sourceValues = source.getOrDefault(field, List.of());
            if (sourceValues.isEmpty()) {
                // Apply never clears a field it has no value for, so an absent source value is not
                // a difference.
                continue;
            }

            if (!equivalent(sourceValues, existing.getOrDefault(field, List.of()))) {
                differing.add(field);
            }
        }
        return List.copyOf(differing);
    }

    /** Unordered comparison of value/language pairs, matching how apply decides to patch. */
    private boolean equivalent(List<DspaceMetadataValue> sourceValues, List<DspaceMetadataValue> existingValues) {
        if (sourceValues.size() != existingValues.size()) {
            return false;
        }

        List<List<String>> remaining = new ArrayList<>(sourceValues.stream()
                .map(DspaceItemDiffPlanner::comparisonKey)
                .toList());
        for (DspaceMetadataValue existingValue : existingValues) {
            if (!remaining.remove(comparisonKey(existingValue))) {
                return false;
            }
        }
        return remaining.isEmpty();
    }

    private static List<String> comparisonKey(DspaceMetadataValue value) {
        return List.of(normalize(value.value()), normalize(value.language()));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String summarize(List<String> fields) {
        if (fields.size() <= MAX_REPORTED_FIELDS) {
            return String.join(", ", fields);
        }
        return String.join(", ", fields.subList(0, MAX_REPORTED_FIELDS))
                + " and " + (fields.size() - MAX_REPORTED_FIELDS) + " more";
    }
}
