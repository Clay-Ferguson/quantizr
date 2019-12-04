package org.subnode.test;

import org.subnode.actpub.CryptoUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

// if this works go back and thank this guy: 
// https://gist.github.com/destan/b708d11bd4f403506d6d5bb5fe6a82c5
// Bash Commands:
// openssl genrsa -out private_key.pem 4096
// openssl rsa -pubout -in private_key.pem -out public_key.pem
// # convert private key to pkcs8 format in order to import it from Java
// openssl pkcs8 -topk8 -in private_key.pem -inform pem -out private_key_pkcs8.pem -outform pem -nocrypt
//...
// what i ACTUALLY RAN:
// openssl genrsa -out private.pem 2048
// openssl rsa -in private.pem -outform PEM -pubout -out public.pem
// openssl pkcs8 -topk8 -in private.pem -inform pem -out private_pkcs8.pem -outform pem -nocrypt
public class CryptoTest {
    private static final Logger log = LoggerFactory.getLogger(CryptoTest.class);

    @Autowired
    private CryptoUtil cryptoUtil;

    public void test() throws Exception {
        log.debug("Crypto Test currently commented out.");
        //meh, let's comment out the CryptoTest for now. 
        // log.debug("CRYPTO TEST.");

        // String now = new Date().toString();
        // String stringToSign = "(request-target): post /inbox\nhost: mastodon.social\ndate: " + now;

        // String signedString = cryptoUtil.sign(stringToSign);
        // log.debug("Signed Output: "+signedString);
    }
}
