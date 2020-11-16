package org.subnode.config;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

/**
 * Supposedly this property (below) can also turn on pretty printing, but i
 * never tried that, because i know I want the most powerful way of controlling
 * formatting in case i need to do more advanced formatting at some point in the
 * future. spring.jackson.serialization.indent_output=true
 */
@Configuration
public class JacksonConfig {

    // NOTE: I never got this class working with WebMvcConfigurationSupport, because
    // it always disables the app
    // because something in Spring MVC is broken in it and even the index.html
    // cannot load correctly, so instead i'm using the @Bean below.
    // extends WebMvcConfigurationSupport {
    // @Override
    // protected void extendMessageConverters(List<HttpMessageConverter<?>>
    // converters) {
    // super.addDefaultHttpMessageConverters(converters);
    // for (HttpMessageConverter<?> converter : converters) {
    // if (converter instanceof MappingJackson2HttpMessageConverter) {
    // MappingJackson2HttpMessageConverter jacksonConverter =
    // (MappingJackson2HttpMessageConverter) converter;
    // jacksonConverter.setPrettyPrint(true);
    // }
    // }
    // }

    @Bean
    public MappingJackson2HttpMessageConverter mappingJackson2HttpMessageConverter() {
        MappingJackson2HttpMessageConverter jsonConverter = new MappingJackson2HttpMessageConverter();
        ObjectMapper objectMapper = new ObjectMapper();
        // objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
        // false);
        
        jsonConverter.setObjectMapper(objectMapper);
        jsonConverter.setPrettyPrint(true);
        return jsonConverter;
    }
}