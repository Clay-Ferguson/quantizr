package quanta.service;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.model.Jwk;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.RemoveSignaturesRequest;
import quanta.rest.request.SavePublicKeyRequest;
import quanta.rest.request.SignNodesRequest;
import quanta.rest.request.SignSubGraphRequest;
import quanta.rest.request.SubGraphHashRequest;
import quanta.rest.response.NodeSigData;
import quanta.rest.response.NodeSigPushInfo;
import quanta.rest.response.PushPageMessage;
import quanta.rest.response.RemoveSignaturesResponse;
import quanta.rest.response.SavePublicKeyResponse;
import quanta.rest.response.SignNodesResponse;
import quanta.rest.response.SignSubGraphResponse;
import quanta.rest.response.SubGraphHashResponse;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.val.BooleanVal;
import quanta.util.val.IntVal;
import quanta.util.val.Val;

@Component
public class CryptoService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(CryptoService.class);
    private final ConcurrentHashMap<Integer, NodeSigPushInfo> sigPendingQueue = new ConcurrentHashMap<>();
    private final HashSet<String> failedSigNodes = new HashSet<>();
    private final HashSet<String> unsignedPublicNodes = new HashSet<>();
    private static final Random rand = new Random();
    private static boolean debugSigning = false;
    private int SIGN_BLOCK_SIZE = 100;

    public CryptoService() {
        log.debug("CryptoService created: failedSigNodes=" + failedSigNodes.hashCode());
    }

    public HashSet<String> getFailedSigNodes() {
        return failedSigNodes;
    }

    public HashSet<String> getUnsignedPublicNodes() {
        return unsignedPublicNodes;
    }

    public boolean nodeSigVerify(SubNode node, String sig) {
        if (sig.equals(Constant.SIG_TBD.s()))
            return false;
        return nodeSigVerify(node, sig, null);
    }

    /*
     * For locations where we know we can reuse a mapping of IDs to nodes we have the option to pass in
     * nodeMap to this method for a performance boost
     */
    public boolean nodeSigVerify(SubNode node, String sig, HashMap<String, AccountNode> accountNodeMap) {
        // Nodes with TBD in their signature are in the process of being signed
        // or about to be signed.
        if (sig == null || node == null || Constant.SIG_TBD.s().equals(sig))
            return false;
        PublicKey pubKey = null;
        try {
            AccountNode ownerAccntNode =
                    accountNodeMap != null ? accountNodeMap.get(node.getOwner().toHexString()) : null;

            // if we didn't have a cache or didn't find in cache try to get node from db
            if (ownerAccntNode == null) {
                // log.debug("Cache Miss: " + node.getOwner());
                ownerAccntNode = svc_user.getAccountNodeAP(node.getOwner());
                if (ownerAccntNode == null) {
                    log.error("sig check failed. Can't find owner of node: " + node.getIdStr());
                    return false;
                } else {
                    if (accountNodeMap != null) {
                        accountNodeMap.put(ownerAccntNode.getIdStr(), ownerAccntNode);
                    }
                }
            } else {
                // log.debug("Cache Hit: " + ownerAccntNode.getIdStr());
            }
            String pubKeyJson = ownerAccntNode.getStr(NodeProp.USER_PREF_PUBLIC_SIG_KEY);

            if (pubKeyJson == null) {
                log.debug("User Account didn't have SIG KEY: accntNodeId=" + ownerAccntNode.getIdStr()
                        + " They own nodeId=" + node.getIdStr());
                return false;
            }
            pubKey = parseJWK(pubKeyJson);
            if (pubKey == null) {
                log.error("Unable generate USER_PREF_PUBLIC_SIG_KEY for accnt " + ownerAccntNode.getIdStr());
                return false;
            }

            String strToSign = getNodeSigData(node);
            boolean verified =
                    sigVerify(pubKey, Util.hexStringToBytes(sig), strToSign.getBytes(StandardCharsets.UTF_8));

            if (!verified) {
                log.error("sig check failed. nodeId=" + node.getIdStr() + //
                        "\n sig=" + sig + //
                        "\n strToSign=" + strToSign + //
                        "\n pubKeyJson=" + pubKeyJson);
            }
            return verified;
        } catch (Exception e) {
            ExUtil.error(log, "crypto sig failed on " + node.getIdStr(), e);
        }
        return false;
    }

    /*
     * Builds the string that will be the raw data that's cryptographically signed
     * 
     * see: #signature-format (in TypeScript)
     */
    public String getNodeSigData(SubNode node) {
        String path = node.getPath();
        if (path.startsWith(NodePath.PENDING_PATH + "/")) {
            path = NodePath.ROOT_PATH + "/" + path.substring(5);
        }
        String strToSign = path + "-" + node.getOwner().toHexString();
        if (StringUtils.isNotEmpty(node.getContent())) {
            strToSign += "-" + node.getContent();
        }
        List<Attachment> atts = node.getOrderedAttachments();
        if (atts != null && atts.size() > 0) {
            for (Attachment att : atts) {
                if (att.getBin() != null) {
                    strToSign += "-" + att.getBin();
                }
                if (att.getBinData() != null) {
                    strToSign += "-" + att.getBinData();
                }
            }
        }
        return strToSign;
    }

    /*
     * some day we need to find a cleaner way to parse JWK, but this seems to be the best solution
     * everyone is using based on my google searches.
     */
    public PublicKey parseJWK(String jwkJson) {
        PublicKey pubKey = null;
        try {
            Jwk keyObj = Util.mapper.readValue(jwkJson.getBytes(StandardCharsets.UTF_8), Jwk.class);
            if (keyObj == null) {
                log.error("Unable to parse USER_PREF_PUBLIC_SIG_KEY from accnt");
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

    public boolean sigVerify(PublicKey pubKey, byte[] sigBytes, byte[] dataBytes) {
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(pubKey);
            verifier.update(dataBytes);
            return verifier.verify(sigBytes);
        } catch (Exception e) {
            throw new RuntimeEx("Signature Failed", e);
        }
    }

    public void sigCheckScan() {
        if (!svc_prop.isRequireCrypto())
            return;

        svc_arun.run(() -> {
            IntVal count = new IntVal(0);
            Criteria crit = svc_mongoUtil.subGraphCriteria(NodePath.PUBLIC_PATH);
            Query query = new Query();
            query.addCriteria(crit);

            svc_ops.forEach(query, node -> {
                count.inc();
                if (node.hasProp(NodeProp.CRYPTO_SIG.s())) {
                    if (!nodeSigVerify(node, node.getStr(NodeProp.CRYPTO_SIG))) {
                        failedSigNodes.add(node.getIdStr());
                    }
                } else {
                    unsignedPublicNodes.add(node.getIdStr());
                }
            });
            log.debug("sigCheckScan complete. " + count.getVal() + " nodes checked.");
            return null;
        });
    }

    public SignNodesResponse signNodes(SignNodesRequest req) {
        MongoTranMgr.ensureTran();
        // if the signPendingQueue contains the workload we assume it's the same workload, which is fine
        // because we aren't doing that security right here.
        if (sigPendingQueue.containsKey(req.getWorkloadId())) {
            BulkOperations bops = null;
            int batchSize = 0;

            for (NodeSigData data : req.getListToSign()) {
                ObjectId id = new ObjectId(data.getNodeId());
                SubNode node = svc_mongoRead.getNode(id);
                svc_auth.ownerAuth(node);

                // if we found the node and this setter DID change it's value, then we save.
                if (node != null && node.set(NodeProp.CRYPTO_SIG, data.getData())) {
                    // clean so we won't let this node get persisted, because we're doing the persist in this bulk op
                    TL.clean(node);
                    bops = svc_mongoUpdate.bulkOpSetPropVal(bops, id, SubNode.PROPS, node.getProps(), false);
                    if (++batchSize > Const.MAX_BULK_OPS) {
                        bops.execute();
                        batchSize = 0;
                        bops = null;
                    }
                }
            }
            if (bops != null) {
                bops.execute();
            }

            if (debugSigning) {
                log.debug("signSubGraph finished workload: " + req.getWorkloadId());
            }
            sigPendingQueue.remove(req.getWorkloadId());
        } else {
            log.warn("Unknown workload id: " + req.getWorkloadId());
        }
        return new SignNodesResponse();
    }

    public void signNodesById(List<String> ids) {
        if (ids == null || ids.size() == 0)
            return;
        SessionContext sc = TL.getSC();

        NodeSigPushInfo pushInfo = new NodeSigPushInfo(Math.abs(rand.nextInt()));
        int errorCount = 0;

        for (String id : ids) {
            if (pushInfo == null) {
                pushInfo = new NodeSigPushInfo(Math.abs(rand.nextInt()));
            }

            SubNode node = svc_mongoRead.getNode(id);
            if (node == null) {
                continue;
            }

            // add this node.
            String sigData = getNodeSigData(node);
            pushInfo.getListToSign().add(new NodeSigData(node.getIdStr(), sigData));
            if (debugSigning) {
                log.debug("signed: nodeId=" + node.getIdStr() + " sig=" + sigData);
            }

            // if we have enough to send a block send it.
            if (pushInfo.getListToSign().size() >= SIGN_BLOCK_SIZE) {
                if (!waitForBrowserSentSigs(sc, pushInfo)) {
                    errorCount++;
                    continue;
                }
                // reset the push object.
                pushInfo = null;
            }
        }

        // process any remainder
        if (pushInfo != null && pushInfo.getListToSign().size() > 0) {
            if (!waitForBrowserSentSigs(sc, pushInfo)) {
                errorCount++;
            }
        }

        if (errorCount > 0) {
            svc_push.pushInfo(sc, new PushPageMessage("Failed signing " + errorCount + " nodes.", true, "error"));
        }
    }

    public void signSubGraph(SessionContext sc, SignSubGraphRequest req) {
        if (debugSigning) {
            log.debug("signSubGraph of nodeId: " + req.getNodeId());
        }

        SubNode parent = svc_mongoRead.getNode(req.getNodeId());
        if (parent == null) {
            return;
        }

        // query all nodes under the path that are owned by 'ms'
        Criteria crit = svc_mongoUtil.subGraphCriteria(parent.getPath())//
                .and(SubNode.OWNER).is(TL.getSC().getUserNodeObjId());

        // if we're only signing unsigned nodes, then we add this criteria
        if (req.isSignUnsigned()) {
            crit.and(SubNode.PROPS + "." + NodeProp.CRYPTO_SIG.s()).exists(false);
        }

        // Query DB for all nodes we're going to sign
        Query query = new Query();
        crit = svc_auth.addReadSecurity(crit);
        query.addCriteria(crit);
        IntVal count = new IntVal();

        Val<NodeSigPushInfo> pushInfo = new Val<>();
        pushInfo.setVal(new NodeSigPushInfo(Math.abs(rand.nextInt())));
        pushInfo.getVal().setListToSign(new LinkedList<>());

        String sig = getNodeSigData(parent);
        if (debugSigning) {
            log.debug("signed: nodeId=" + parent.getIdStr() + " sig=" + sig);
        }

        if (!req.isSignUnsigned() || !parent.hasProp(NodeProp.CRYPTO_SIG.s())) {
            // add in root node first
            pushInfo.getVal().getListToSign().add(new NodeSigData(parent.getIdStr(), sig));
            count.inc();
        }

        BooleanVal failed = new BooleanVal();

        svc_ops.forEach(query, node -> {
            // make sure session is still alive
            if (failed.getVal() || !sc.isLive())
                return;
            // create new push object lazily
            if (pushInfo.getVal() == null) {
                pushInfo.setVal(new NodeSigPushInfo(Math.abs(rand.nextInt())));
                pushInfo.getVal().setListToSign(new LinkedList<>());
            }
            // add this node.
            String sig1 = getNodeSigData(node);
            pushInfo.getVal().getListToSign().add(new NodeSigData(node.getIdStr(), sig1));
            if (debugSigning) {
                log.debug("signed: nodeId=" + node.getIdStr() + " sig=" + sig1);
            }
            count.inc();
            // if we have enough to send a block send it.
            if (pushInfo.getVal().getListToSign().size() >= SIGN_BLOCK_SIZE) {
                if (!waitForBrowserSentSigs(sc, pushInfo.getVal())) {
                    failed.setVal(true);
                }
                // reset the push object.
                pushInfo.setVal(null);
            }
        });

        // make sure session is still alive
        if (failed.getVal() || !sc.isLive())
            return;

        // send the accumulated remainder
        if (pushInfo.getVal() != null && pushInfo.getVal().getListToSign().size() > 0) {
            if (!waitForBrowserSentSigs(sc, pushInfo.getVal())) {
                failed.setVal(true);
            }
            // make sure session is still alive
            if (failed.getVal() || !sc.isLive())
                return;
        }
        svc_push.pushInfo(sc,
                new PushPageMessage(
                        "SubGraph signatures complete. " + String.valueOf(count.getVal()) + " nodes were signed.", true,
                        "note"));
    }

    // This method pushes data down to the browser to be signed and waits for the reply here.
    private boolean waitForBrowserSentSigs(SessionContext sc, NodeSigPushInfo pushInfo) {
        sigPendingQueue.put(pushInfo.getWorkloadId(), pushInfo);
        svc_push.pushInfo(sc, pushInfo);
        Util.sleep(2000);
        long totalTime = 0;
        long sleepTime = 100;
        // we wait for up to 30 seconds for the browser to sign the nodes, before we will give up and
        // return false;

        while (totalTime < 30000 && sc.isLive() && sigPendingQueue.contains(pushInfo.getWorkloadId())) {
            Util.sleep(sleepTime);
            totalTime += sleepTime;
        }
        return totalTime < 30000;
    }

    public Object signSubGraph(SignSubGraphRequest req) {
        MongoTranMgr.ensureTran();
        // run the signing in an async thread, so we can push messages back to browser from it without
        // any session mutexing getting in the way
        svc_async.run(() -> {
            svc_crypto.signSubGraph(TL.getSC(), req);
        });
        return new SignSubGraphResponse();
    }

    public Object removeSignatures(RemoveSignaturesRequest req) {
        MongoTranMgr.ensureTran();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        String sigProp = SubNode.PROPS + "." + NodeProp.CRYPTO_SIG.s();

        if (node == null) {
            throw new RuntimeEx("Unknown node: " + req.getNodeId());
        }
        svc_auth.ownerAuth(node);

        // query for the subgraph under 'node' for all nodes that have the sigProp and are owned by us
        Criteria crit = svc_mongoUtil.subGraphCriteria(node.getPath())//
                .and(sigProp).exists(true) //
                .and(SubNode.OWNER).is(TL.getSC().getUserNodeObjId());

        Query query = new Query();
        query.addCriteria(crit);

        Val<BulkOperations> bops = new Val<>(svc_ops.bulkOps(BulkMode.UNORDERED));
        svc_mongoUpdate.bulkOpDelProp(bops.getVal(), node.getId(), sigProp);
        IntVal batchSize = new IntVal(1);

        svc_ops.forEach(query, n -> {
            // lazy create bops
            if (!bops.hasVal()) {
                bops.setVal(svc_ops.bulkOps(BulkMode.UNORDERED));
            }

            svc_mongoUpdate.bulkOpDelProp(bops.getVal(), n.getId(), sigProp);
            batchSize.inc();

            if (batchSize.getVal() > Const.MAX_BULK_OPS) {
                bops.getVal().execute();
                batchSize.setVal(0);
                bops.setVal(null);
            }
        });
        if (bops.hasVal()) {
            bops.getVal().execute();
        }
        return new RemoveSignaturesResponse();
    }

    /**
     * Gets ths sig key json from "sc", and assigns it into "sc" if not assigned yet.
     */
    public String getPubSigKeyJson(SessionContext sc) {
        String json = sc.getPubSigKeyJson();

        if (json == null) {
            AccountNode userNode = svc_user.getAccountByUserNameAP(sc.getUserName());
            if (userNode == null) {
                throw new RuntimeEx("Unknown user: " + sc.getUserName());
            }
            json = userNode.getStr(NodeProp.USER_PREF_PUBLIC_SIG_KEY);
            if (json == null) {
                throw new RuntimeEx("User Account didn't have SIG KEY: userName: " + sc.getUserName());
            }
            sc.setPubSigKeyJson(json);
        }
        return json;
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
                if (!StringUtils.isEmpty(req.getSigKey())) {
                    // force pubSigKey to regenerate as needed by setting to null
                    TL.getSC().setPubSigKeyJson(null);
                    userNode.set(NodeProp.USER_PREF_PUBLIC_SIG_KEY, req.getSigKey());
                }
            } else {
                log.debug("savePublicKey failed to find userName: " + userName);
            }
            return null;
        });
        return res;
    }

    public void authSig() {
        if (!svc_prop.isRequireCrypto()) {
            return;
        }

        SessionContext sc = TL.getSC();
        if (sc == null) {
            throw new RuntimeEx("Unable to get SessionContext to check token.");
        }

        String sig = TL.getReqSig();
        if (StringUtils.isEmpty(sig)) {
            throw new RuntimeEx("Request failed. No signature.");
        }

        String pkJson = svc_crypto.getPubSigKeyJson(sc);
        boolean verified = svc_crypto.sigVerify(svc_crypto.parseJWK(pkJson), Util.hexStringToBytes(sig),
                sc.getUserName().getBytes(StandardCharsets.UTF_8));

        if (!verified) {
            throw new RuntimeEx(
                    "Request Sig Failed. Probably wrong signature key in browser for user " + sc.getUserName());
        }
    }
}
