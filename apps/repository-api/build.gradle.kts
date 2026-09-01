plugins {
    java
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.openapi.generator") version "7.10.0"
}

group = "org.civicsrepo"
version = "0.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

/**
 * Generates Java DTOs from the OpenAPI contract.
 *
 * The frontend has been generated from `repository-api.yaml` with a drift check since early on,
 * while the Java side was hand-written against the same schema. That asymmetry meant the backend
 * could diverge from the contract the frontend is built on, and nothing would notice.
 *
 * Models only, deliberately. The `spring` generator can also emit controller interfaces, but those
 * are written against Spring 6 conventions and this service runs Spring 7 / Boot 4; adopting them
 * is a separate change with its own failure modes. DTOs are where drift actually hurts.
 *
 * Output lands in `build/generated` and is git-ignored: it is build output, and the contract is the
 * committed source of truth.
 */
val openApiSpec = layout.projectDirectory.file("../../schemas/openapi/repository-api.yaml")
val generatedSources = layout.buildDirectory.dir("generated/openapi")

openApiGenerate {
    generatorName = "spring"
    inputSpec = openApiSpec.asFile.absolutePath
    outputDir = generatedSources.map { it.asFile.absolutePath }
    modelPackage = "org.civicsrepo.generated.dto"
    apiPackage = "org.civicsrepo.generated.api"
    // Models only: no api classes, no docs, no tests, no supporting HTTP client scaffolding.
    globalProperties =
        mapOf(
            "models" to "",
            "modelDocs" to "false",
            "modelTests" to "false",
            "apis" to "false",
            "apiDocs" to "false",
            "apiTests" to "false",
            "supportingFiles" to "false",
        )
    configOptions =
        mapOf(
            // The spring generator emits Jackson-annotated, Jakarta-validated models. The java
            // generator defaults to an okhttp/gson client library and produces models that pull in
            // Gson, which this service does not use.
            "useSpringBoot3" to "true",
            "useJakartaEe" to "true",
            "serializationLibrary" to "jackson",
            "openApiNullable" to "false",
            "hideGenerationTimestamp" to "true",
            "useTags" to "true",
            // No Swagger annotations on the DTOs. They would only decorate types the contract
            // already describes, and would add a dependency purely for that decoration.
            "annotationLibrary" to "none",
            "documentationProvider" to "none",
        )
}

sourceSets {
    named("main") {
        java.srcDir(generatedSources.map { it.dir("src/main/java") })
    }
}

// Generation runs before compilation, so editing the contract cannot leave the Java side stale:
// a breaking schema change fails the build rather than surfacing at runtime.
tasks.named("compileJava") {
    dependsOn(tasks.named("openApiGenerate"))
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
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    implementation("jakarta.transaction:jakarta.transaction-api")
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