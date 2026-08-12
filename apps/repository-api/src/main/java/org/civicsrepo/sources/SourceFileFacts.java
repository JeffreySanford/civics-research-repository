package org.civicsrepo.sources;

import java.time.LocalDate;

/**
 * What the publishing host reports about a source file.
 *
 * <p>Size and publication date are facts about the file that change when the publisher reissues it,
 * so compiling them in makes them wrong the moment that happens. They are read from the response
 * headers instead. Either can be absent: not every host sends {@code Content-Length} or {@code
 * Last-Modified}, and an absent value is left absent rather than guessed.
 */
public record SourceFileFacts(Long sizeBytes, LocalDate lastModified) {}
