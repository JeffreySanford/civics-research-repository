# syntax=docker/dockerfile:1.7

FROM gradle:9.6-jdk21 AS dependencies
WORKDIR /workspace/apps/repository-api
# Resolve the dependency graph in its own layer so source changes do not force a
# re-download. Only settings.gradle.kts/build.gradle.kts invalidate this layer.
COPY apps/repository-api/settings.gradle.kts apps/repository-api/build.gradle.kts ./
# The OpenAPI contract is read at build time to generate Java DTOs, so it belongs in the layer that
# resolves and warms the build, not only in the source layer.
COPY schemas/openapi/repository-api.yaml /workspace/schemas/openapi/repository-api.yaml
RUN gradle --no-daemon resolveDependencies

FROM dependencies AS build
COPY apps/repository-api/src ./src
RUN gradle --no-daemon bootJar

FROM build AS test
RUN gradle --no-daemon test

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /workspace/apps/repository-api/build/libs/repository-api-0.1.0.jar /app/repository-api.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/repository-api.jar"]
