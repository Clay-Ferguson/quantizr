package org.subnode.actpub;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import org.subnode.config.AppProp;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.util.FileUtils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * This paragram will line wrap this is a test to verify that line wrapping
 * works
 * <p>
 * <code>

    if this works go back and thank this guy: 
    https://gist.github.com/destan/b708d11bd4f403506d6d5bb5fe6a82c5
    Bash Commands (from above link)
    openssl genrsa -out private_key.pem 4096
    openssl rsa -pubout -in private_key.pem -out public_key.pem
    # convert private key to pkcs8 format in order to import it from Java
    openssl pkcs8 -topk8 -in private_key.pem -inform pem -out private_key_pkcs8.pem -outform pem -nocrypt
    
    what i ACTUALLY RAN:
    openssl genrsa -out private.pem 2048
    openssl rsa -in private.pem -outform PEM -pubout -out public.pem
    openssl pkcs8 -topk8 -in private.pem -inform pem -out private_pkcs8.pem -outform pem -nocrypt

 * </code>
 */

@Component
public class CryptoUtil {
    private static final Logger log = LoggerFactory.getLogger(CryptoUtil.class);

    private static final Object keyPairLock = new Object();
    private static KeyPair keyPair;

    @Autowired
    AppProp appProp;

    /* Returns signed AND Base64 encoded string */
    public String sign(String stringToSign) {
        try {
            byte[] data = stringToSign.getBytes("UTF8");

            KeyPair keyPair = getKeyPair();

            Signature sig = Signature.getInstance("SHA1WithRSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(data);
            byte[] signatureBytes = sig.sign();
            String encodedString = Base64.getEncoder().encodeToString(signatureBytes);

            // Let’s now decode that String back to the original form:
            // byte[] decodedBytes = Base64.getDecoder().decode(encodedString);
            // String decodedString = new String(decodedBytes);

            // sig.initVerify(keyPair.getPublic());
            // sig.update(data);
            // System.out.println(sig.verify(signatureBytes));

            return encodedString;
        } catch (Exception e) {
            throw new RuntimeEx("signer failed.", e);
        }
    }

    private KeyPair getKeyPair() throws Exception {
        if (keyPair != null) {
            return keyPair;
        }

        synchronized (keyPairLock) {
            String publicKeyContent = FileUtils.readFile(appProp.getRsaKeyFolder() + "/public.pem");
            String privateKeyContent = FileUtils.readFile(appProp.getRsaKeyFolder() + "/private_pkcs8.pem");

            privateKeyContent = stripKeyDelimiters(privateKeyContent, "PRIVATE");
            publicKeyContent = stripKeyDelimiters(publicKeyContent, "PUBLIC");

            KeyFactory kf = KeyFactory.getInstance("RSA");

            PKCS8EncodedKeySpec keySpecPKCS8 = new PKCS8EncodedKeySpec(Base64.getDecoder().decode(privateKeyContent));
            PrivateKey privKey = kf.generatePrivate(keySpecPKCS8);

            X509EncodedKeySpec keySpecX509 = new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyContent));
            RSAPublicKey pubKey = (RSAPublicKey) kf.generatePublic(keySpecX509);

            return (keyPair = new KeyPair(pubKey, privKey));
        }
    }

    private String stripKeyDelimiters(String key, String access) {
        return key.replaceAll("\\n", "").replace("-----BEGIN " + access + " KEY-----", "")
                .replace("-----END " + access + " KEY-----", "");
    }
}
