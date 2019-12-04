package org.subnode.util;

// import java.nio.charset.StandardCharsets;
// import java.security.Key;

// import javax.crypto.Cipher;
// import javax.crypto.spec.SecretKeySpec;
// import javax.xml.bind.DatatypeConverter;

// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.stereotype.Component;

// import org.subnode.config.AppProp;

/**
 * Symmetric Encryption using AES
 * 
 * It's highly recommended that you put --aeskey=XXXXXXXXXXXXXXXX not in a text file but as a
 * command line parameter when the application is started so that a hacker has to gain access to
 * your actual launch script to see the password.
 * 
 * see also:
 * http://docs.oracle.com/javase/8/docs/technotes/guides/security/crypto/CryptoSpec.html#SimpleEncrEx
 * 
 * For password checking, it would be a bit better to use a one-way hash like this:
 * https://stackoverflow.com/questions/22580853/reliable-implementation-of-pbkdf2-hmac-sha256-for-java
 * 
 * Two examples from that page of possible hash implementations (neither of which i have yet
 * tested):
 * 
 * Snippet #1 (bouncy castle)
 * 
 * <code>
 * PKCS5S2ParametersGenerator gen = new PKCS5S2ParametersGenerator(new SHA256Digest());
 * gen.init("password".getBytes("UTF-8"), "salt".getBytes(), 4096);
 * byte[] dk = ((KeyParameter) gen.generateDerivedParameters(256)).getKey();
 * </code>
 * 
 * Snippet #2
 * 
 * <code>
 *     KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, derivedKeyLength * 8);
 *     SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
 *     String hash = f.generateSecret(spec).getEncoded();
 * </code>
 * 
 */
//@Component
public class Encryptor {

	// @Autowired
	// public AppProp appProp;

	// private Key aesKey = null;
	// private Cipher cipher = null;

	// synchronized private void init() {
	// 	try {
	// 		if (appProp.getAesKey() == null || appProp.getAesKey().length() != 16) {
	// 			throw ExUtil.newEx("bad aes key configured");
	// 		}
	// 		if (aesKey == null) {
	// 			aesKey = new SecretKeySpec(appProp.getAesKey().getBytes(StandardCharsets.UTF_8), "AES");

	// 			/*
	// 			 * Per conversations on StackOverflow, and research, I think "AES/ECB/PKCS5Padding"
	// 			 * is better here than plain "AES" but I haven't researched more.
	// 			 */
	// 			cipher = Cipher.getInstance("AES");
	// 		}
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// }

	// synchronized public String encrypt(String text) {
	// 	try {
	// 		init();
	// 		cipher.init(Cipher.ENCRYPT_MODE, aesKey);
	// 		return DatatypeConverter.printBase64Binary(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)));
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// }

	// synchronized public String decrypt(String text) {
	// 	try {
	// 		init();
	// 		cipher.init(Cipher.DECRYPT_MODE, aesKey);
	// 		return new String(cipher.doFinal(DatatypeConverter.parseBase64Binary(text)));
	// 	}
	// 	catch (Exception ex) {
	// 		throw ExUtil.newEx(ex);
	// 	}
	// }
}