package org.civicsrepo.federation;

/** Source-specific fetcher that also normalizes publisher records into the shared catalog shape. */
public interface FederatedSourceHarvester {
    FederatedSourceSystem sourceSystem();

    HarvestPage fetch(String cursor, int pageSize);
}
