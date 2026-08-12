plugins {
    java
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "org.civicsrepo"
version = "0.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

/**
 * Downloads the compile and test dependency graphs without needing any source.
 *
 * The Docker build runs this in its own layer so that editing Java code does not invalidate the
 * dependency cache. `dependencies` only reports the graph; this resolves the artifacts.
 */
tasks.register("resolveDependencies") {
    val resolvable = listOf(
        configurations.named("compileClasspath"),
        configurations.named("testRuntimeClasspath"),
    )
    doLast {
        resolvable.forEach { it.get().resolve() }
    }
}

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // Spring Boot 4 moved the MockMvc/@WebMvcTest slice out of spring-boot-test-autoconfigure into
    // its own module, so it has to be requested explicitly.
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
    // In-memory datasource so the Spring context and the JDBC sync job store can be tested without
    // a running PostgreSQL container.
    testRuntimeOnly("com.h2database:h2")
}
