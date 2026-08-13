package org.civicsrepo.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.stream.Collectors;
import org.civicsrepo.dspace.AmbiguousDspaceItemException;
import org.civicsrepo.dspace.DspaceUnavailableException;
import org.civicsrepo.generated.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Maps failures to the OpenAPI {@link ErrorResponse} contract so frontend clients receive typed
 * errors instead of Spring Boot's default problem JSON.
 */
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(
            ResponseStatusException exception, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(exception.getStatusCode().value());
        return ResponseEntity.status(status)
                .body(error(codeFor(status), messageOrDefault(exception, status), null, traceId(request)));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(
            NoResourceFoundException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(error("NOT_FOUND", "API route not found: " + request.getRequestURI(), null, traceId(request)));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    public ResponseEntity<ErrorResponse> handleValidation(Exception exception, HttpServletRequest request) {
        List<String> details = validationDetails(exception);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(error("BAD_REQUEST", "Request validation failed.", details, traceId(request)));
    }

    @ExceptionHandler(DspaceUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleDspaceUnavailable(
            DspaceUnavailableException exception, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(error("SERVICE_UNAVAILABLE", exception.getMessage(), null, traceId(request)));
    }

    @ExceptionHandler(AmbiguousDspaceItemException.class)
    public ResponseEntity<ErrorResponse> handleAmbiguousDspaceItem(
            AmbiguousDspaceItemException exception, HttpServletRequest request) {
        LOGGER.error("Ambiguous DSpace item match: {}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error("INTERNAL_ERROR", exception.getMessage(), null, traceId(request)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
        LOGGER.error("Unhandled API error", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error("INTERNAL_ERROR", "An unexpected error occurred.", null, traceId(request)));
    }

    private static ErrorResponse error(String code, String message, List<String> details, String traceId) {
        ErrorResponse response = new ErrorResponse(code, message);
        if (details != null && !details.isEmpty()) {
            response.details(details);
        }
        if (traceId != null && !traceId.isBlank()) {
            response.traceId(traceId);
        }
        return response;
    }

    private static String traceId(HttpServletRequest request) {
        Object value = request.getAttribute(TraceIdFilter.TRACE_ID_ATTRIBUTE);
        return value == null ? null : value.toString();
    }

    private static String codeFor(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "BAD_REQUEST";
            case NOT_FOUND -> "NOT_FOUND";
            case SERVICE_UNAVAILABLE -> "SERVICE_UNAVAILABLE";
            default -> status.is5xxServerError() ? "INTERNAL_ERROR" : status.name();
        };
    }

    private static String messageOrDefault(ResponseStatusException exception, HttpStatus status) {
        if (exception.getReason() != null && !exception.getReason().isBlank()) {
            return exception.getReason();
        }
        return status.getReasonPhrase();
    }

    private static List<String> validationDetails(Exception exception) {
        if (exception instanceof MethodArgumentNotValidException validation) {
            return validation.getBindingResult().getFieldErrors().stream()
                    .map(error -> error.getField() + ": " + error.getDefaultMessage())
                    .collect(Collectors.toList());
        }
        if (exception instanceof MethodArgumentTypeMismatchException mismatch) {
            return List.of(mismatch.getName() + ": invalid value");
        }
        return List.of(exception.getMessage());
    }
}
