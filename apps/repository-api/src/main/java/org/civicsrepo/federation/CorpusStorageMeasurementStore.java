package org.civicsrepo.federation;

import java.util.List;

/** Historical persistence boundary for measured local corpus storage. */
public interface CorpusStorageMeasurementStore {
    void save(CorpusStorageMeasurement measurement);

    List<CorpusStorageMeasurement> findRecent(int limit);

    List<CorpusStorageMeasurement> findRecentByProfile(CorpusProfile profile, int limit);
}
