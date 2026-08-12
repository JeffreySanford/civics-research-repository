package org.civicsrepo.datasets;

import org.civicsrepo.generated.dto.DatasetDetail;
import org.civicsrepo.generated.dto.DatasetVersion;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/datasets")
public class DatasetController {
    private final DatasetService datasetService;

    public DatasetController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping("/{datasetId}")
    public DatasetDetail getDataset(@PathVariable String datasetId) {
        return datasetService.getDataset(datasetId);
    }

    @GetMapping("/{datasetId}/versions")
    public List<DatasetVersion> getDatasetVersions(@PathVariable String datasetId) {
        return datasetService.getDatasetVersions(datasetId);
    }
}
