package org.civicsrepo.config;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.lang.NonNull;

/**
 * Binds request parameters to generated enums by their contract value rather than by constant name.
 *
 * <p>Spring's default enum binding calls {@code Enum.valueOf}, which needs the Java constant name.
 * That is fine while the two agree, and they usually do — but the OpenAPI generator renames a
 * constant whose value puts a digit run after an underscore: the contract value {@code USGS_3DEP}
 * becomes the Java constant {@code USGS_3_DEP}. Jackson is unaffected because the generated models
 * carry {@code @JsonCreator fromValue}, so request bodies and responses stayed correct; query
 * parameters do not go through Jackson, so {@code ?program=USGS_3DEP} started failing with 400
 * while every other program kept working.
 *
 * <p>This routes binding through the same {@code fromValue} Jackson uses, so one spelling — the
 * contract's — works everywhere. Enums without {@code fromValue} keep the default behavior.
 */
public class ContractEnumConverterFactory implements ConverterFactory<String, Enum> {

    @Override
    @NonNull
    public <T extends Enum> Converter<String, T> getConverter(@NonNull Class<T> targetType) {
        Method fromValue = fromValueMethod(targetType);
        return (source) -> convert(source, targetType, fromValue);
    }

    private <T extends Enum> T convert(String source, Class<T> targetType, Method fromValue) {
        String trimmed = source == null ? "" : source.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        if (fromValue == null) {
            return targetType.cast(Enum.valueOf(targetType.asSubclass(Enum.class), trimmed));
        }

        try {
            return targetType.cast(fromValue.invoke(null, trimmed));
        } catch (IllegalAccessException | InvocationTargetException exception) {
            // fromValue throws IllegalArgumentException for an unknown value, which Spring turns
            // into a 400. Unwrap it so the caller sees that rather than a reflection failure.
            Throwable cause = exception instanceof InvocationTargetException invocation ? invocation.getCause() : null;
            if (cause instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalArgumentException("Unable to convert \"" + trimmed + "\" to " + targetType.getSimpleName());
        }
    }

    private Method fromValueMethod(Class<?> targetType) {
        try {
            Method method = targetType.getDeclaredMethod("fromValue", String.class);
            return java.lang.reflect.Modifier.isStatic(method.getModifiers()) ? method : null;
        } catch (NoSuchMethodException exception) {
            return null;
        }
    }
}
