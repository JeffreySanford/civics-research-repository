package org.civicsrepo.sync;

import jakarta.validation.constraints.NotNull;

public record SyncRequest(@NotNull SyncMode mode, @NotNull SyncSource source) {}
