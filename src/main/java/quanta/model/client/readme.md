# NOTES:

Classes in this package (in addition to Request and Respons classes) are exported into typescript (using typescript-generator-maven-plugin), and this is currently still the only way to achieve "constants" in Java converted to Typescript. It would be nice of we could just hava a class with
a bunch of string values in it but there's no way to do that and then have it export to TypeScript correctly, so even for just plain constants we have to use a Java enum, even when we ideally wouldn't have wanted to.

It will be a simple transformation we can do some day to convert these 'enums' to just ordinary classes with static final properties in them, and that will probably require writing out own simple generator that can read a properties file, and then spit out a TypeScript version of it as well as the Java version.

Optional Properties:

Hello, short answer is optionalProperties parameter (http://www.habarta.cz/typescript-generator/maven/typescript-generator-maven-plugin/generate-mojo.html#optionalProperties).

There are two steps in optional properties processing:

determining which properties are optional
marking optional properties in output
Typescript-generator can detect optional properties annotated with @JsonProperty(required = false), just set optionalProperties parameter to useLibraryDefinition value. Unfortunatelly for historical reasons this is not a default.

Output can be controlled using optionalPropertiesDeclaration parameter, exactly as you mentioned.

====================
Random example from online:
    <plugin>
        <groupId>cz.habarta.typescript-generator</groupId>
        <artifactId>typescript-generator-maven-plugin</artifactId>
        <version>2.17.558</version>
        <executions>
            <execution>
                <id>generate</id>
                <phase>process-classes</phase>
                <goals>
                    <goal>generate</goal>
                </goals>
            </execution>
        </executions>
        <configuration>
            <jsonLibrary>jackson2</jsonLibrary>
            <classPatterns>
                <classPattern>com.test.tsgen.**</classPattern>
            </classPatterns>
            <excludeClasses>
                <excludeClass>java.io.Serializable</excludeClass>
                <excludeClass>java.lang.Comparable</excludeClass>
            </excludeClasses>
            <mapClasses>asClasses</mapClasses>
            <mapDate>asDate</mapDate>
            <mapEnum>asEnum</mapEnum>
            <nonConstEnums>true</nonConstEnums>
            <mapPackagesToNamespaces>true</mapPackagesToNamespaces>
            <optionalProperties>useLibraryDefinition</optionalProperties>
            <outputFile>model.ts</outputFile>
            <outputFileType>implementationFile</outputFileType>
            <outputKind>module</outputKind>
        </configuration>
    </plugin>