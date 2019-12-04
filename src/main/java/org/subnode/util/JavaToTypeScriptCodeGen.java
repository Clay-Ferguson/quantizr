package org.subnode.util;

//import java.io.File;
//import java.util.LinkedList;
//import java.util.List;
//
//import org.slf4j.Logger;
//import org.slf4j.LoggerFactory;
//
//import cz.habarta.typescript.generator.Input;
//import cz.habarta.typescript.generator.JsonLibrary;
//import cz.habarta.typescript.generator.Output;
//import cz.habarta.typescript.generator.Settings;
//import cz.habarta.typescript.generator.TypeScriptFileType;
//import cz.habarta.typescript.generator.TypeScriptGenerator;
//import cz.habarta.typescript.generator.TypeScriptOutputKind;

/**
 * Currently unused 'CZ Habarta' implementation of TypeScript code generation from Java (I used this
 * class when originally converting lots of Java to TypeScript, but haven't needed it since, because
 * I don't have the need to to this 'en masse' and just to it by hand currently)
 */
public class JavaToTypeScriptCodeGen {

	// private static final Logger log = LoggerFactory.getLogger(JavaToTypeScriptCodeGen.class);
	//
	// public JavaToTypeScriptCodeGen() {
	// }
	//
	// /*
	// * The commented code below DOES work, and will generate the TypeScript, however the
	// TypeScript
	// * it generates doesn't prefix the 'interface' definitions with 'export', and also doesn't
	// have
	// * a way to wrap the namespace in the two namespaces I have. So the json-models.ts this code
	// * generates is not perfectly what I need, so what I have now started doing is updating the
	// * json-models.ts file by hand, rather than using this code generation.
	// */
	// public static void main(String[] args) {
	// try {
	// List<String> classNamePatterns = new LinkedList<String>();
	// classNamePatterns.add("org.subnode.model.*");
	// classNamePatterns.add("org.subnode.request.*");
	// classNamePatterns.add("org.subnode.response.*");
	// Input input = Input.fromClassNamesAndJaxrsApplication(null, classNamePatterns, null, false,
	// null, new JavaToTypeScriptCodeGen().getClass().getClassLoader());
	// Output output = Output.to(new
	// File("/home/clay/ferguson/SubNode-Project/src/main/resources/public/ts/json-models.ts"));
	// Settings settings = new Settings();
	// settings.outputKind = TypeScriptOutputKind.global;
	// settings.outputFileType = TypeScriptFileType.declarationFile;
	// settings.jsonLibrary = JsonLibrary.jackson2;
	// settings.namespace = "m64";
	// TypeScriptGenerator gen = new TypeScriptGenerator(settings);
	// gen.generateTypeScript(input, output);
	// }
	// catch (Exception e) {
	// e.printStackTrace();
	// }
	//
	// log.info("Finished Java->TypeScript code generation.");
	// }
}
