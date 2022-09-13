package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.config.ServiceBase;
import quanta.model.Jwk;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;

@Component
public class CryptoService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(CryptoService.class);

	// This key will be needed so often we cache it.
	// todo-0: for now a server restart is required if admin changes their keys.
	private static PublicKey adminPublicSigKey = null;

	public static final ObjectMapper mapper = new ObjectMapper();
	// NOTE: This didn't allow unknown properties as expected but putting the
	// following in the JSON classes did:
	// @JsonIgnoreProperties(ignoreUnknown = true)
	{
		mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
	}

	/*
	 * Note having NO signature on the node is currently considered 'valid' as an unsigned node, but
	 * only if there's a signature to we check it for being valid.
	 */
	public boolean nodeSigVerify(SubNode node, String checkSig) {
		String sig = ok(checkSig) ? checkSig : node.getStr(NodeProp.CRYPTO_SIG);

		/*
		 * if no signature exists, for now we consider this a valid node.
		 */
		if (no(sig)) {
			return true;
		}

		PublicKey pubKey = null;
		MongoSession adminSession = auth.getAdminSession();
		boolean adminOwned = false;
		if (ok(adminSession) && adminSession.getUserNodeId().equals(node.getOwner())) {
			adminOwned = true;
			pubKey = adminPublicSigKey;
		}

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

				// cache the admin key if adminOwned
				if (adminOwned) {
					adminPublicSigKey = pubKey;
				}
			}

			// all new nodes not yet saved end up in 'pending' path (/r/p) until final save so we sign it as if
			// it's already out at the final path it will be at by replacing with '/r/'
			String path = node.getPath();
			if (path.startsWith("/r/p/")) {
				path = "/r/" + path.substring(5);
			}

			String strToSign = path + "-" + node.getOwner().toHexString();
			if (StringUtils.isNotEmpty(node.getContent())) {
				strToSign += "-" + node.getContent();
			}

			boolean verified = sigVerify(pubKey, Util.hexStringToBytes(sig), strToSign.getBytes());
			if (!verified) {
				log.debug("SIG FAIL nodeId: " + node.getIdStr() + "\nsigData: [" + strToSign + "] signature: " + sig);
			}
			return verified;
		} catch (Exception e) {
			ExUtil.error(log, "crypto sig failed", e);
		}

		return false;
	}

	/*
	 * some day we need to find a cleaner way to parse JWK, but this seems to be the best solution
	 * everyone is using based on my google searches.
	 */
	public PublicKey parseJWK(String jwkJson, SubNode accntNode) {
		PublicKey pubKey = null;
		try {
			// log.debug("parsing: " + pubKeyJson);
			Jwk keyObj = mapper.readValue(jwkJson.getBytes(), Jwk.class);
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
			// Signature is not threadsafe (afaik) however it can be reused so we hold one on each thread for
			// reuse
			Signature verifier = ThreadLocals.getCryptoSig();
			if (no(verifier)) {
				verifier = Signature.getInstance("SHA256withRSA");
				ThreadLocals.setCryptoSig(verifier);
			}
			verifier.initVerify(pubKey);
			verifier.update(dataBytes);
			return verifier.verify(sigBytes);
		} catch (Exception e) {
			ExUtil.error(log, "exception in signature", e);
			throw new RuntimeException(e);
		}
	}
}
