package quanta.actpub;

import static quanta.actpub.model.AP.apObj;
import static quanta.actpub.model.AP.apStr;
import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.actpub.model.APObj;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.service.UserManagerService;
import quanta.util.XString;

/**
 * Crypto functions for AP
 */
@Component
public class ActPubCrypto extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubCrypto.class);

    /* Gets private RSA key from current user session */
    public String getPrivateKey(MongoSession ms, String userName) {
        /* First try to return the key from the cache */
        String privateKey = UserManagerService.privateKeysByUserName.get(userName);
        if (ok(privateKey)) {
            return privateKey;
        }

        /* get the userNode for the current user who edited a node */
        SubNode userNode = read.getUserNodeByUserName(ms, userName);
        if (no(userNode)) {
            return null;
        }

        /* get private key of this user so we can sign the outbound message */
        privateKey = userNode.getStr(NodeProp.CRYPTO_KEY_PRIVATE);
        if (no(privateKey)) {
            log.debug("Unable to update federated users. User didn't have a private key on his userNode: " + userName);
            return null;
        }

        // add to cache.
        UserManagerService.privateKeysByUserName.put(userName, privateKey);
        return privateKey;
    }

    public void verifySignature(HttpServletRequest httpReq, PublicKey pubKey) {
        String reqHeaderSignature = httpReq.getHeader("Signature");
        if (no(reqHeaderSignature)) {
            throw new RuntimeException("Signature missing from http header.");
        }

        final List<String> sigTokens = XString.tokenize(reqHeaderSignature, ",", true);
        if (no(sigTokens) || sigTokens.size() < 3) {
            throw new RuntimeException("Signature tokens missing from http header.");
        }

        String keyID = null;
        String signature = null;
        List<String> headers = null;

        for (String sigToken : sigTokens) {
            int equalIdx = sigToken.indexOf("=");

            // ignore tokens not containing equals
            if (equalIdx == -1)
                continue;

            String key = sigToken.substring(0, equalIdx);
            String val = sigToken.substring(equalIdx + 1);

            if (val.charAt(0) == '"') {
                val = val.substring(1, val.length() - 1);
            }

            if (key.equalsIgnoreCase("keyId")) {
                keyID = val;
            } else if (key.equalsIgnoreCase("headers")) {
                headers = Arrays.asList(val.split(" "));
            } else if (key.equalsIgnoreCase("signature")) {
                signature = val;
            }
        }

        if (no(keyID))
            throw new RuntimeException("Header signature missing 'keyId'");
        if (no(headers))
            throw new RuntimeException("Header signature missing 'headers'");
        if (no(signature))
            throw new RuntimeException("Header signature missing 'signature'");
        if (!headers.contains("(request-target)"))
            throw new RuntimeException("(request-target) is not in signed headers");
        if (!headers.contains("date"))
            throw new RuntimeException("date is not in signed headers");
        if (!headers.contains("host"))
            throw new RuntimeException("host is not in signed headers");

        // todo-1: currently not validating time
        // String date = httpReq.getHeader("date");
        // apUtil.validateRequestTime(date);

        /*
         * NOTE: keyId will be the actor url with "#main-key" appended to it, and if we wanted to verify
         * that only incomming messages from users we 'know' are allowed, we could do that, but for now we
         * simply verify that they are who they claim to be using the signature check below, and that is all
         * we want. (i.e. unknown users can post in)
         */
        byte[] signableBytes = getHeaderSignatureBytes(httpReq, headers);
        byte[] sigBytes = Base64.getDecoder().decode(signature);

        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(pubKey);
            verifier.update(signableBytes);
            if (!verifier.verify(sigBytes)) {
                throw new RuntimeException("Signature verify failed.");
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public PublicKey getPublicKeyFromActor(Object actorObj) {
        PublicKey pubKey = null;
        Object pubKeyObj = apObj(actorObj, APObj.publicKey);
        if (no(pubKeyObj))
            return null;

        String pkeyEncoded = apStr(pubKeyObj, APObj.publicKeyPem);
        if (no(pkeyEncoded))
            return null;

        // WARNING: This is a REGEX. replaceAll() uses REGEX.
        pkeyEncoded = pkeyEncoded.replaceAll("-----(BEGIN|END) (RSA )?PUBLIC KEY-----", "").replace("\n", "").trim();

        byte[] key = Base64.getDecoder().decode(pkeyEncoded);
        try {
            X509EncodedKeySpec spec = new X509EncodedKeySpec(key);
            pubKey = KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            log.debug("Failed to generate publicKey from encoded: " + pkeyEncoded);
            // Notes from other Platform code:
            // a simpler RSA key format, used at least by Misskey
            // Misskey user objects also contain a key "isCat" which I ignore
            // RSAPublicKeySpec spec=decodeSimpleRSAKey(key);
            // pubKey=KeyFactory.getInstance("RSA").generatePublic(spec);
        }

        return pubKey;
    }

    private byte[] getHeaderSignatureBytes(HttpServletRequest httpReq, List<String> headers) {
        ArrayList<String> sigParts = new ArrayList<>();
        for (String header : headers) {
            String value;
            if (header.equals("(request-target)")) {
                value = httpReq.getMethod().toLowerCase() + " " + httpReq.getRequestURI();
            } else {
                value = httpReq.getHeader(header);
            }
            sigParts.add(header + ": " + value);
        }

        String strToSign = String.join("\n", sigParts);
        byte[] signableBytes = strToSign.getBytes(StandardCharsets.UTF_8);
        return signableBytes;
    }
}
