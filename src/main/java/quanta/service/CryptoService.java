package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.bulk.BulkWriteResult;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.Jwk;
import quanta.model.client.Attachment;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.SignNodesRequest;
import quanta.request.SignSubGraphRequest;
import quanta.response.NodeSigData;
import quanta.response.NodeSigPushInfo;
import quanta.response.PushPageMessage;
import quanta.response.SignNodesResponse;
import quanta.util.ExUtil;
import quanta.util.IntVal;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.Val;

@Component
public class CryptoService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(CryptoService.class);
	public static final ObjectMapper mapper = new ObjectMapper();

	public final ConcurrentHashMap<Integer, NodeSigPushInfo> sigPendingQueue = new ConcurrentHashMap<>();
	private static final Random rand = new Random();

	int SIGN_BLOCK_SIZE = 200;

	// NOTE: This didn't allow unknown properties as expected but putting the
	// following in the JSON classes did:
	// @JsonIgnoreProperties(ignoreUnknown = true)
	{
		mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
	}

	public boolean nodeSigVerify(SubNode node, String sig) {
		if (no(sig) || no(node))
			return false;
		PublicKey pubKey = null;

		try {
			// if we didn't get this as admin key we'll be generating the key
			if (no(pubKey)) {
				// log.debug("Checking Signature: " + sig + " nodeId: " + node.getIdStr());
				SubNode ownerAccntNode = arun.run(as -> read.getNode(as, node.getOwner()));
				if (no(ownerAccntNode)) {
					log.error("sig check failed. Can't find owner of node: " + node.getIdStr());
					return false;
				}

				String pubKeyJson = ownerAccntNode.getStr(NodeProp.USER_PREF_PUBLIC_SIG_KEY);
				if (no(pubKeyJson)) {
					log.debug("User Account didn't have SIG KEY: accntNodeId=" + ownerAccntNode.getIdStr() + " They own nodeId="
							+ node.getIdStr());
					return false;
				}

				// todo-1: eventually we can cache each user's key, but this will require work for
				// a multi-node (load balanced) system
				pubKey = parseJWK(pubKeyJson, ownerAccntNode);
				if (no(pubKey)) {
					log.error("Unable generate USER_PREF_PUBLIC_SIG_KEY for accnt " + ownerAccntNode.getIdStr());
					return false;
				}
			}

			String strToSign = getNodeSigData(node);

			boolean verified = sigVerify(pubKey, Util.hexStringToBytes(sig), strToSign.getBytes(StandardCharsets.UTF_8));
			if (!verified) {
				// log.debug("SIG FAIL nodeId: " + node.getIdStr() + "\nsigData: [" + strToSign + "] signature: " + sig);
			}
			return verified;
		} catch (Exception e) {
			ExUtil.error(log, "crypto sig failed on " + node.getIdStr(), e);
		}

		return false;
	}

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
		if (ok(atts) && atts.size() > 0) {
			for (Attachment att : atts) {
				if (ok(att.getBin())) {
					strToSign += "-" + att.getBin();
				}
				if (ok(att.getBinData())) {
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
	public PublicKey parseJWK(String jwkJson, SubNode accntNode) {
		PublicKey pubKey = null;
		try {
			// log.debug("parsing: " + pubKeyJson);
			Jwk keyObj = mapper.readValue(jwkJson.getBytes(StandardCharsets.UTF_8), Jwk.class);
			if (no(keyObj)) {
				log.error("Unable to parse USER_PREF_PUBLIC_SIG_KEY from accnt " + accntNode.getIdStr());
				return null;
			}

			BigInteger modulus = new BigInteger(1, Base64.getUrlDecoder().decode(keyObj.getN()));
			BigInteger exponent = new BigInteger(1, Base64.getUrlDecoder().decode(keyObj.getE()));

			// figure out if we can reuse the same instance or if we always need a new one (todo-1)
			pubKey = KeyFactory.getInstance("RSA").generatePublic(new RSAPublicKeySpec(modulus, exponent));
			if (no(keyObj)) {
				log.error("Unable generate USER_PREF_PUBLIC_SIG_KEY for accnt " + accntNode.getIdStr());
				return null;
			}
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
			ExUtil.error(log, "exception in signature", e);
			throw new RuntimeException(e);
		}
	}

	public void signNodes(MongoSession ms, SignNodesRequest req, SignNodesResponse res) {
		/*
		 * if the signPendingQueue contains the workload we assume it's the same workload, which is fine
		 * because we aren't doing that security right here.
		 */
		if (sigPendingQueue.containsKey(req.getWorkloadId())) {
			BulkOperations bops = null;

			for (NodeSigData data : req.getListToSign()) {
				ObjectId id = new ObjectId(data.getNodeId());

				/*
				 * todo-1: we could optimize this and be faster by using an 'in clause' to lookup all the nodes in a
				 * single query instead of doing this 'getNode' on each one.
				 */
				SubNode node = read.getNode(ms, id);

				// if we found the node and this setter DID change it's value, then we save.
				if (ok(node) && node.set(NodeProp.CRYPTO_SIG, data.getData())) {
					// clean so we won't let this node get persisted, because we're doing the persist in this bulk op
					ThreadLocals.clean(node);

					bops = update.bulkOpSetPropVal(bops, id, SubNode.PROPS, node.getProps());
				}
			}

			if (ok(bops)) {
				BulkWriteResult results = bops.execute();
				// log.debug("Sigs set on " + results.getModifiedCount() + " nodes.");
			}
			sigPendingQueue.remove(req.getWorkloadId());
		} else {
			log.warn("Unknown workload id: " + req.getWorkloadId());
		}
	}

	public void signSubGraph(MongoSession ms, SessionContext sc, SignSubGraphRequest req) {
		SubNode parent = read.getNode(ms, req.getNodeId());
		if (no(parent)) {
			return;
		}

		// query all nodes under the path that are owned by 'ms'
		Criteria criteria = Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(parent.getPath())) //
				.and(SubNode.OWNER).is(ms.getUserNodeId());

		Val<NodeSigPushInfo> pushInfo = new Val<>();
		Query query = new Query();
		query.addCriteria(criteria);
		IntVal count = new IntVal();

		// add in root node first
		pushInfo.setVal(new NodeSigPushInfo(Math.abs(rand.nextInt())));
		pushInfo.getVal().setListToSign(new LinkedList<>());
		pushInfo.getVal().getListToSign().add(new NodeSigData(parent.getIdStr(), getNodeSigData(parent)));
		count.inc();

		ops.stream(query, SubNode.class).forEachRemaining(node -> {

			// create new push object lazily
			if (no(pushInfo.getVal())) {
				pushInfo.setVal(new NodeSigPushInfo(Math.abs(rand.nextInt())));
				pushInfo.getVal().setListToSign(new LinkedList<>());
			}

			// add this node.
			pushInfo.getVal().getListToSign().add(new NodeSigData(node.getIdStr(), getNodeSigData(node)));
			count.inc();

			// if we have enough to send a block send it.
			if (pushInfo.getVal().getListToSign().size() >= SIGN_BLOCK_SIZE) {
				// log.debug("BLOCK: " + XString.prettyPrint(pushInfo));
				waitForBrowserSentSigs(sc, pushInfo.getVal());
				// reset the push object.
				pushInfo.setVal(null);
			}
		});

		// send the accumulated remainder
		if (ok(pushInfo.getVal()) && pushInfo.getVal().getListToSign().size() > 0) {
			// log.debug("REMAIN: " + XString.prettyPrint(pushInfo));
			waitForBrowserSentSigs(sc, pushInfo.getVal());
		}

		push.sendServerPushInfo(sc, new PushPageMessage(
				"SubGraph signatures complete. " + String.valueOf(count.getVal()) + " nodes were signed.", true));
	}

	// This method pushes data down to the browser to be signed and waits for the reply here.
	private void waitForBrowserSentSigs(SessionContext sc, NodeSigPushInfo pushInfo) {
		sigPendingQueue.put(pushInfo.getWorkloadId(), pushInfo);
		push.sendServerPushInfo(sc, pushInfo);

		// todo-1: for now we're using pooling. Will use thread concurrent api later, and will also have
		// a timeout in case browser isn't sending
		while (sigPendingQueue.contains(pushInfo.getWorkloadId())) {
			Util.sleep(100);
		}
	}
}
