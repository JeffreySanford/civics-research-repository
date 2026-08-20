package org.civicsrepo.sources;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * One test over every adapter, rather than one test per adapter.
 *
 * <p>Per-adapter tests assert that an adapter returns the constants it was written with, which is a
 * tautology: change the constant and the test changes with it. That is exactly how the CPS adapter
 * sat pinned to {@code cps-public-use-2025} while the catalog seeded {@code cps-public-use-2026} --
 * its own test agreed with it, and nothing compared the two.
 *
 * <p>These assert the properties that must hold for an adapter to be useful at all, and they hold
 * for adapters nobody has written yet. Adding the nine remaining programs costs no new test file.
 */
class MetadataAdapterContractTest {
    private final CatalogMetadataReader catalogMetadataReader = new CatalogMetadataReader();

    private final List<PublicMetadataAdapter> adapters = List.of(
            new TigerLineMetadataAdapter(new OfflineSourceFileProbe(), catalogMetadataReader),
            new LodesMetadataAdapter(new OfflineSourceFileProbe(), catalogMetadataReader),
            new CpsMetadataAdapter(new OfflineSourceFileProbe()),
            new SippMetadataAdapter(new OfflineSourceFileProbe()),
            new UsgsEarthquakesMetadataAdapter(new OfflineSourceFileProbe()),
            new AcsPumsMetadataAdapter(catalogMetadataReader),
            new EconomicCensusMetadataAdapter(catalogMetadataReader),
            new CountyBusinessPatternsMetadataAdapter(catalogMetadataReader),
            new BuildingPermitsMetadataAdapter(catalogMetadataReader),
            new PopulationEstimatesMetadataAdapter(catalogMetadataReader),
            new SaipeMetadataAdapter(catalogMetadataReader),
            new BusinessDynamicsMetadataAdapter(catalogMetadataReader),
            new Usgs3depMetadataAdapter(catalogMetadataReader),
            new Usgs3hpMetadataAdapter(catalogMetadataReader));

    /**
     * The check that would have caught the CPS drift.
     *
     * <p>An adapter that harvests an identifier the repository does not hold makes apply search for
     * an item that does not exist and fail the job -- silently, if nothing ever runs that source.
     */
    @Test
    void everyHarvestedIdentifierExistsInTheCatalog() {
        Set<String> catalogIdentifiers = catalogIdentifiers();

        for (PublicMetadataAdapter adapter : adapters) {
            assertThat(adapter.harvest())
                    .as("%s harvest", adapter.source().getValue())
                    .isNotEmpty();

            assertThat(adapter.harvest())
                    .as("%s harvests only identifiers the catalog holds", adapter.source().getValue())
                    .allSatisfy((metadata) ->
                            assertThat(catalogIdentifiers).contains(metadata.id()));
        }
    }

    /** The representative object has to be one of the harvested ones, or the cap can drop it. */
    @Test
    void theRepresentativeObjectIsPartOfTheHarvest() {
        for (PublicMetadataAdapter adapter : adapters) {
            ResearchObjectMetadata representative = adapter.firstVisualSlice();

            assertThat(adapter.harvest())
                    .as("%s representative", adapter.source().getValue())
                    .extracting(ResearchObjectMetadata::id)
                    .contains(representative.id());
        }
    }

    /** Two objects with one identifier would have them overwrite each other in the repository. */
    @Test
    void harvestedIdentifiersAreUnique() {
        for (PublicMetadataAdapter adapter : adapters) {
            List<String> identifiers =
                    adapter.harvest().stream().map(ResearchObjectMetadata::id).toList();

            assertThat(identifiers)
                    .as("%s identifiers", adapter.source().getValue())
                    .doesNotHaveDuplicates();
        }
    }

    /** Every object needs the fields the payload mapper reads, or apply writes blanks. */
    @Test
    void harvestedObjectsCarryTheFieldsTheMapperRequires() {
        for (PublicMetadataAdapter adapter : adapters) {
            assertThat(adapter.harvest()).allSatisfy((metadata) -> {
                assertThat(metadata.id()).as("id").isNotBlank();
                assertThat(metadata.title()).as("title").isNotBlank();
                assertThat(metadata.program()).as("program").isNotNull();
                assertThat(metadata.sourceUrl()).as("sourceUrl").isNotBlank();
                assertThat(metadata.releasedOn()).as("releasedOn").isNotNull();
                assertThat(metadata.vintageYear()).as("vintageYear").isNotNull();
                assertThat(metadata.contentType()).as("contentType").isNotNull();
                assertThat(metadata.accessLevel()).as("accessLevel").isNotNull();
            });
        }
    }

    /** An adapter reporting one source while harvesting another program's objects is a wiring bug. */
    @Test
    void everyAdapterReportsADistinctSource() {
        List<String> sources =
                adapters.stream().map((adapter) -> adapter.source().getValue()).toList();

        assertThat(sources).doesNotHaveDuplicates();
    }

    private Set<String> catalogIdentifiers() {
        return java.util.Arrays.stream(org.civicsrepo.generated.dto.ResearchProgram.values())
                .flatMap((program) -> catalogMetadataReader.forProgram(program).stream())
                .map(ResearchObjectMetadata::id)
                .collect(Collectors.toSet());
    }
}
