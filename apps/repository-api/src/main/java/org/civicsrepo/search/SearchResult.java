package org.civicsrepo.search;

public record SearchResult(
        String id,
        String title,
        ResearchObjectType contentType,
        ResearchProgram program,
        String publisher,
        String summary,
        String geography,
        Integer vintageYear,
        String sourceUrl) {}
