# syntax=docker/dockerfile:1.7

FROM gradle:9.6-jdk21 AS build
WORKDIR /workspace/apps/repository-api
COPY apps/repository-api/settings.gradle.kts apps/repository-api/build.gradle.kts ./
COPY apps/repository-api/src ./src
RUN gradle --no-daemon clean bootJar

FROM build AS test
RUN gradle --no-daemon test

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /workspace/apps/repository-api/build/libs/repository-api-0.1.0.jar /app/repository-api.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/repository-api.jar"]
