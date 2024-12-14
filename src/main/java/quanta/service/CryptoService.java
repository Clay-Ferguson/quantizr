package quanta.service;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Random;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.model.Jwk;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.SavePublicKeyRequest;
import quanta.rest.request.SubGraphHashRequest;
import quanta.rest.response.SavePublicKeyResponse;
import quanta.rest.response.SubGraphHashResponse;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.Util;

@Component
public class CryptoService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(CryptoService.class);

    public CryptoService() {}

    /*
     * some day we need to find a cleaner way to parse JWK, but this seems to be the best solution
     * everyone is using based on my google searches.
     */
    public PublicKey parseJWK(String jwkJson) {
        PublicKey pubKey = null;
        try {
            Jwk keyObj = Util.mapper.readValue(jwkJson.getBytes(StandardCharsets.UTF_8), Jwk.class);
            if (keyObj == null) {
                log.error("Unable to parse cryto from accnt");
                return null;
            }
            BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(keyObj.getN()));
            BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(keyObj.getE()));
            pubKey = KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(modulus, exponent));
        } catch (Exception e) {
            ExUtil.error(log, "parseJWK failed", e);
        }
        return pubKey;
    }

    /*
     * This method will eventually use push+recieve to send node data down to the browser, but I'm
     * putting here for now the ability to use it (temporarily) as a SHA-256 hash generator that
     * generates the hash of all subnodes, and will just stick thas hash into a property on the top
     * parent node (req.nodeId)
     */
    public SubGraphHashResponse cm_subGraphHash(SubGraphHashRequest req) {
        SubGraphHashResponse res = new SubGraphHashResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);
        String prevHash = null;
        String newHash = null;
        try {
            long totalBytes = 0;
            long nodeCount = 0;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            if (req.isRecursive()) {
                StringBuilder sb = new StringBuilder();

                for (SubNode n : svc_mongoRead.getSubGraphAP(node, Sort.by(Sort.Direction.ASC, SubNode.PATH), 0, false,
                        null)) {
                    nodeCount++;
                    sb.append(n.getPath());
                    sb.append("-");
                    sb.append(n.getOwner().toHexString());
                    sb.append(StringUtils.isNotEmpty(n.getContent()) + "-" + n.getContent());
                    List<Attachment> atts = n.getOrderedAttachments();
                    if (atts != null && atts.size() > 0) {
                        for (Attachment att : atts) {
                            if (att.getBin() != null) {
                                sb.append(StringUtils.isNotEmpty(n.getContent()) + "-bin" + att.getBin());
                            }
                            if (att.getBinData() != null) {
                                sb.append(StringUtils.isNotEmpty(n.getContent()) + "-bindat" + att.getBinData());
                            }
                        }
                    }
                    if (sb.length() > 4096) {
                        byte[] b = sb.toString().getBytes(StandardCharsets.UTF_8);
                        totalBytes += b.length;
                        digest.update(b);
                        sb.setLength(0);
                    }
                }
                if (sb.length() > 0) {
                    byte[] b = sb.toString().getBytes(StandardCharsets.UTF_8);
                    totalBytes += b.length;
                    digest.update(b);
                }
            }
            byte[] encodedHash = digest.digest();
            newHash = String.valueOf(nodeCount) + " nodes, " + String.valueOf(totalBytes) + " bytes: "
                    + Util.bytesToHex(encodedHash);
            prevHash = node.getStr(NodeProp.SUBGRAPH_HASH);
            node.set(NodeProp.SUBGRAPH_HASH, newHash);
        } catch (Exception e) {
            res.error("Failed generating hash");
            return res;
        }
        boolean hashChanged = prevHash != null && !prevHash.equals(newHash);
        res.setMessage(
                (hashChanged ? "Hash CHANGED: " : (prevHash == null ? "New Hash: " : "Hash MATCHED!: ")) + newHash);
        return res;
    }

    public SavePublicKeyResponse cm_savePublicKeys(SavePublicKeyRequest req) {
        SavePublicKeyResponse res = new SavePublicKeyResponse();
        String userName = TL.getSC().getUserName();
        svc_arun.run(() -> {
            AccountNode userNode = svc_user.getAccountByUserNameAP(userName);
            if (userNode != null) {
                if (!StringUtils.isEmpty(req.getAsymEncKey())) {
                    userNode.set(NodeProp.USER_PREF_PUBLIC_KEY, req.getAsymEncKey());
                }
            } else {
                log.debug("savePublicKey failed to find userName: " + userName);
            }
            return null;
        });
        return res;
    }
}
