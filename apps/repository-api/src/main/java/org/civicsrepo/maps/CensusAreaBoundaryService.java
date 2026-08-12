package org.civicsrepo.maps;

import java.util.List;
import org.civicsrepo.generated.dto.CensusAreaBoundary;
import org.springframework.stereotype.Service;

@Service
public class CensusAreaBoundaryService {
    private static final List<CensusAreaBoundary> BOUNDARIES = List.of(
            boundary("alabama", "Alabama", -88.4732, 30.2233, -84.8891, 35.008, 32.8067, -86.7911, 6),
            boundary("alaska", "Alaska", -179.1489, 51.2142, 179.7785, 71.3652, 64.2008, -149.4937, 3),
            boundary("arizona", "Arizona", -114.8165, 31.3322, -109.0452, 37.0043, 34.0489, -111.0937, 6),
            boundary("arkansas", "Arkansas", -94.6179, 33.0041, -89.6444, 36.4996, 35.201, -91.8318, 6),
            boundary("california", "California", -124.4096, 32.5343, -114.1312, 42.0095, 36.7783, -119.4179, 5),
            boundary("colorado", "Colorado", -109.0603, 36.9924, -102.0416, 41.0034, 39.5501, -105.7821, 6),
            boundary("connecticut", "Connecticut", -73.7278, 40.9801, -71.786, 42.0506, 41.6032, -73.0877, 8),
            boundary("delaware", "Delaware", -75.789, 38.451, -75.0489, 39.839, 38.9108, -75.5277, 8),
            boundary(
                    "district-of-columbia",
                    "District of Columbia",
                    -77.1198,
                    38.7916,
                    -76.9094,
                    38.9955,
                    38.9072,
                    -77.0369,
                    10),
            boundary("florida", "Florida", -87.6349, 24.3963, -80.0314, 31.0009, 27.6648, -81.5158, 6),
            boundary("georgia", "Georgia", -85.6052, 30.3579, -80.8397, 35.0007, 32.1656, -82.9001, 6),
            boundary("hawaii", "Hawaii", -160.2471, 18.9104, -154.8066, 22.2356, 19.8968, -155.5828, 6),
            boundary("idaho", "Idaho", -117.243, 42.0, -111.0436, 49.0011, 44.0682, -114.742, 5.5),
            boundary("illinois", "Illinois", -91.5131, 36.9703, -87.4948, 42.5083, 40.6331, -89.3985, 6),
            boundary("indiana", "Indiana", -88.0979, 37.7717, -84.7846, 41.7614, 40.2672, -86.1349, 6.5),
            boundary("iowa", "Iowa", -96.6397, 40.3754, -90.1401, 43.5012, 41.878, -93.0977, 6),
            boundary("kansas", "Kansas", -102.0517, 36.993, -94.5884, 40.0031, 39.0119, -98.4842, 6),
            boundary("kentucky", "Kentucky", -89.5715, 36.4971, -81.9649, 39.1475, 37.8393, -84.27, 6),
            boundary("louisiana", "Louisiana", -94.0431, 28.9286, -88.817, 33.0195, 30.9843, -91.9623, 6),
            boundary("maine", "Maine", -71.0839, 42.9778, -66.9499, 47.4597, 45.2538, -69.4455, 6),
            boundary("maryland", "Maryland", -79.4877, 37.9117, -75.0489, 39.723, 39.0458, -76.6413, 7),
            boundary("massachusetts", "Massachusetts", -73.5081, 41.2379, -69.9286, 42.8868, 42.4072, -71.3824, 7),
            boundary("michigan", "Michigan", -90.4184, 41.6961, -82.1228, 48.3061, 44.3148, -85.6024, 5.5),
            boundary("minnesota", "Minnesota", -97.2393, 43.4994, -89.4919, 49.3844, 46.7296, -94.6859, 5.5),
            boundary("mississippi", "Mississippi", -91.655, 30.1739, -88.0979, 34.9961, 32.3547, -89.3985, 6),
            boundary("missouri", "Missouri", -95.7747, 35.9957, -89.0988, 40.6136, 37.9643, -91.8318, 6),
            boundary("montana", "Montana", -116.050, 44.3582, -104.0391, 49.0014, 46.8797, -110.3626, 5),
            boundary("nebraska", "Nebraska", -104.0535, 39.9999, -95.3083, 43.0017, 41.4925, -99.9018, 6),
            boundary("nevada", "Nevada", -120.0065, 35.0019, -114.0396, 42.0022, 38.8026, -116.4194, 5.5),
            boundary("new-hampshire", "New Hampshire", -72.5572, 42.697, -70.6106, 45.3058, 43.1939, -71.5724, 7),
            boundary("new-jersey", "New Jersey", -75.5596, 38.9285, -73.8939, 41.3574, 40.0583, -74.4057, 7),
            boundary("new-mexico", "New Mexico", -109.0502, 31.3323, -103.0019, 37.0002, 34.5199, -105.8701, 6),
            boundary("new-york", "New York", -79.7624, 40.4774, -71.8562, 45.0159, 43.2994, -74.2179, 6),
            boundary("north-carolina", "North Carolina", -84.3219, 33.8423, -75.4606, 36.5881, 35.7596, -79.0193, 6),
            boundary("north-dakota", "North Dakota", -104.0489, 45.9351, -96.5545, 49.0007, 47.5515, -101.002, 6),
            boundary("ohio", "Ohio", -84.8203, 38.4031, -80.5187, 41.9775, 40.4173, -82.9071, 6.5),
            boundary("oklahoma", "Oklahoma", -103.0026, 33.6158, -94.4307, 37.0023, 35.4676, -97.5164, 6),
            boundary("oregon", "Oregon", -124.5662, 41.9918, -116.4635, 46.292, 43.8041, -120.5542, 6),
            boundary("pennsylvania", "Pennsylvania", -80.5199, 39.7198, -74.6895, 42.2699, 41.2033, -77.1945, 6),
            boundary("puerto-rico", "Puerto Rico", -67.2715, 17.8315, -65.5898, 18.5157, 18.2208, -66.5901, 8),
            boundary("rhode-island", "Rhode Island", -71.8628, 41.1463, -71.1206, 42.0188, 41.5801, -71.4774, 8),
            boundary("south-carolina", "South Carolina", -83.3539, 32.0333, -78.542, 35.2155, 33.8361, -81.1637, 6),
            boundary("south-dakota", "South Dakota", -104.0577, 42.4796, -96.4366, 45.9455, 43.9695, -99.9018, 6),
            boundary("tennessee", "Tennessee", -90.3103, 34.9829, -81.6469, 36.6781, 35.5175, -86.5804, 6),
            boundary("texas", "Texas", -106.6456, 25.8371, -93.5083, 36.5007, 31.9686, -99.9018, 5),
            boundary("utah", "Utah", -114.0529, 36.9979, -109.0411, 42.0016, 39.321, -111.0937, 6),
            boundary("vermont", "Vermont", -73.4377, 42.7269, -71.4646, 45.0167, 44.5588, -72.5778, 7),
            boundary("virginia", "Virginia", -83.6754, 36.5407, -75.2423, 39.466, 37.4316, -78.6569, 6),
            boundary("washington", "Washington", -124.8489, 45.5435, -116.916, 49.0025, 47.7511, -120.7401, 6),
            boundary("west-virginia", "West Virginia", -82.6447, 37.2015, -77.719, 40.6388, 38.5976, -80.4549, 7),
            boundary("wisconsin", "Wisconsin", -92.8894, 42.4919, -86.2495, 47.3098, 43.7844, -88.7879, 6),
            boundary("wyoming", "Wyoming", -111.0569, 40.9947, -104.0522, 45.0059, 43.076, -107.2903, 6));

    public List<CensusAreaBoundary> listBoundaries() {
        return BOUNDARIES;
    }

    private static CensusAreaBoundary boundary(
            String id,
            String geography,
            double west,
            double south,
            double east,
            double north,
            double centerLatitude,
            double centerLongitude,
            double defaultZoom) {
        // Built with the generated DTO's fluent setters. The generator emits POJOs rather than
        // records, which is why this reads as a builder chain instead of a constructor call.
        return new CensusAreaBoundary()
                .id(id)
                .label(geography + " Census area boundary preview")
                .geography(geography)
                .west(west)
                .south(south)
                .east(east)
                .north(north)
                .centerLatitude(centerLatitude)
                .centerLongitude(centerLongitude)
                .defaultZoom(defaultZoom);
    }
}
