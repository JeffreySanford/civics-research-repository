package org.civicsrepo.datasets;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.civicsrepo.repository.FixtureCatalog;
import org.civicsrepo.repository.RepositoryCatalog;
import org.civicsrepo.generated.dto.DatasetDetail;
import org.civicsrepo.generated.dto.DatasetVersion;
import org.civicsrepo.generated.dto.RepositorySource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DatasetService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DatasetService.class);

    private final RepositoryCatalog repositoryCatalog;
    private final FixtureCatalog fixtureCatalog;

    public DatasetService() {
        this(null, new FixtureCatalog());
    }

    @Autowired
    public DatasetService(RepositoryCatalog repositoryCatalog, FixtureCatalog fixtureCatalog) {
        this.repositoryCatalog = repositoryCatalog;
        this.fixtureCatalog = fixtureCatalog;
    }

    /**
     * DSpace first, fixtures second.
     *
     * <p>A dataset page served from the repository carries {@link RepositorySource#REPOSITORY}; the
     * generated fallback carries {@link RepositorySource#FIXTURE} so the UI can disclose it. The
     * fallback exists so the demo survives a DSpace outage, not so it can stand in silently.
     */
    public DatasetDetail getDataset(String datasetId) {
        if (repositoryCatalog != null) {
            Optional<DatasetDetail> repositoryDataset = repositoryCatalog.findDataset(datasetId);
            if (repositoryDataset.isPresent()) {
                return repositoryDataset.orElseThrow();
            }
            LOGGER.debug("Dataset {} is not in the repository; using the fixture catalog.", datasetId);
        }

        return fixtureCatalog.findDataset(datasetId).orElseThrow(() -> notFound(datasetId));
    }

    public List<DatasetVersion> getDatasetVersions(String datasetId) {
        DatasetDetail detail = getDataset(datasetId);
        int currentYear = detail.getVintageYear() == null ? 2026 : detail.getVintageYear();

        return List.of(
                new DatasetVersion(datasetId + "-current", detail.getTitle(), true)
                        .releasedOn(detail.getReleasedOn()),
                new DatasetVersion(datasetId + "-previous", detail.getProgram() + " " + (currentYear - 1), false)
                        .releasedOn(LocalDate.of(currentYear - 1, 8, 1)));
    }

    private ResponseStatusException notFound(String datasetId) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Dataset not found: " + datasetId);
    }

}