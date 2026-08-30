package org.civicsrepo.federation;

/** Deployment shape recorded with storage history so Compose and Kubernetes are never conflated. */
public enum DeploymentTopology {
    DOCKER_COMPOSE,
    KIND_CLUSTER,
    OTHER
}
