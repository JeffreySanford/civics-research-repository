package org.civicsrepo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    /**
     * Request parameters bind to generated enums by contract value, not by Java constant name. See
     * {@link ContractEnumConverterFactory}.
     */
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new ContractEnumConverterFactory());
    }

    /**
     * The two local development origins.
     *
     * <p>4200 is the Compose dev server; 4300 is the one Playwright starts. Only 4200 was allowed,
     * so an end-to-end run against the real API had every response blocked, and a blocked raster
     * tile surfaces as "The source image could not be decoded" rather than as a CORS error --
     * which is a genuinely confusing way to spend an afternoon.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:4200", "http://localhost:4300")
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*");
    }
}
