package org.civicsrepo.sync;

public record SyncAction(String actionType, String target, String detail) {}
