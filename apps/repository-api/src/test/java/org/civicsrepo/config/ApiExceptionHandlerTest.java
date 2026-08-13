package org.civicsrepo.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

class ApiExceptionHandlerTest {
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new ApiExceptionHandler())
                .addFilters(new TraceIdFilter())
                .build();
    }

    @Test
    void serializesNotFoundAsTypedErrorResponse() throws Exception {
        mockMvc.perform(get("/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Dataset not found: missing"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void echoesInboundTraceIdHeader() throws Exception {
        mockMvc.perform(get("/not-found").header(TraceIdFilter.TRACE_ID_HEADER, "trace-demo-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.traceId").value("trace-demo-1"));
    }

    @RestController
    static class TestController {
        @GetMapping("/not-found")
        void notFound() {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Dataset not found: missing");
        }
    }
}
