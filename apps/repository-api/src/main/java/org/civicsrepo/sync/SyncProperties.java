package org.civicsrepo.sync;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "civics.sync")
public record SyncProperties(boolean startupEnabled, SyncMode mode, SyncSource source) {}
