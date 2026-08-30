package org.civicsrepo.federation;

/** Source-specific fetcher that also normalizes publisher records into the shared catalog shape. */
public interface FederatedSourceHarvester {
    FederatedSourceSystem sourceSystem();

    /** Version recorded with durable harvest-run evidence and normalized records. */
    default String adapterVersion() {
        return "unversioned:" + getClass().getSimpleName();
    }

    HarvestPage fetch(String cursor, int pageSize);
}
