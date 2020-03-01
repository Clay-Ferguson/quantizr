NOTE: Classes in this package (in addition to Request and Respons classes) are exported into typescript (using typescript-generator-maven-plugin), and this is currently still the only way to achieve "constants" in Java converted to Typescript. It would be nice of we could just hava a class with
a bunch of string values in it but there's no way to do that and then have it export to TypeScript correctly, so even for just plain constants we have to use a Java enum, even when we ideally wouldn't have wanted to.

It will be a simple transformation we can do some day to convert these 'enums' to just ordinary classes with static final properties in them, and that will probably require writing out own simple generator that can read a properties file, and then spit out a TypeScript version of it as well as the Java version.

