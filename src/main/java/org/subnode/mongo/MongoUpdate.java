package org.subnode.mongo;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;

import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.IPFSService;
import org.subnode.util.Cast;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;

@Component
public class MongoUpdate {
	private static final Logger log = LoggerFactory.getLogger(MongoUpdate.class);

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private MongoRead read;

	@Autowired
	private IPFSService ipfs;

	@Autowired
	private AdminRun arun;

	@Autowired
	private MongoAuth auth;

	public void saveObj(Object obj) {
		if (MongoThreadLocal.getWritesDisabled())
			return;
		ops.save(obj);
	}

	public void save(MongoSession session, SubNode node) {
		save(session, node, true);
	}

	public void save(MongoSession session, SubNode node, boolean allowAuth) {
		if (MongoThreadLocal.getWritesDisabled())
			return;
		if (allowAuth) {
			auth.ownerAuth(session, node);
		}
		// log.debug("MongoApi.save: DATA: " + XString.prettyPrint(node));

		// if not doing allowAuth, we need to be sure the thread has admin session
		// so the MongoEventListener can allow all access.
		if (!allowAuth) {
			arun.run(ms -> {
				ops.save(node);
				return null;
			});
		} else {
			ops.save(node);
		}
		MongoThreadLocal.clean(node);
	}

	public void saveSession(MongoSession session) {
		saveSession(session, false);
	}

	public void saveSession(MongoSession session, boolean asAdmin) {
		if (session == null || session.saving || !MongoThreadLocal.hasDirtyNodes() || MongoThreadLocal.getWritesDisabled())
			return;

		try {
			// we check the saving flag to ensure we don't go into circular recursion here.
			session.saving = true;

			synchronized (session) {
				// recheck hasDirtyNodes again after we get inside the lock.
				if (!MongoThreadLocal.hasDirtyNodes()) {
					return;
				}

				/*
				 * We use 'nodes' list to avoid a concurrent modification exception in the loop below
				 */
				List<SubNode> nodes = new LinkedList<>();

				/*
				 * check that we are allowed to write all, before we start writing any
				 */
				for (SubNode node : MongoThreadLocal.getDirtyNodes().values()) {
					if (!asAdmin) {
						auth.auth(session, node, PrivilegeType.WRITE);
					}
					nodes.add(node);
				}

				for (SubNode node : nodes) {
					// log.debug("saveSession: Saving Dirty. nodeId=" + (node.getId()==null ? "null
					// (new node?)" : node.getId().toHexString()));
					save(session, node, false);
				}

				/*
				 * This theoretically should never find any dirty nodes, because we just saved them all but we
				 * definitely still want this line of code here
				 */
				MongoThreadLocal.clearDirtyNodes();
			}
		} finally {
			session.saving = false;
		}
	}

	/*
	 * Unpins any IPFS data that is not currently referenced by MongoDb. Cleans up orphans.
	 */
	public String releaseOrphanIPFSPins(HashMap<ObjectId, UserStats> statsMap) {
		ValContainer<String> ret = new ValContainer<>("failed");
		arun.run(session -> {
			int pinCount = 0, orphanCount = 0;
			LinkedHashMap<String, Object> pins = Cast.toLinkedHashMap(ipfs.getPins());
			if (pins != null) {
				/*
				 * For each CID that is pinned we do a lookup to see if there's a Node that is using that PIN, and
				 * if not we remove the pin
				 */
				for (String pin : pins.keySet()) {
					SubNode ipfsNode = read.findByIPFSPinned(session, pin);
					if (ipfsNode != null) {
						pinCount++;
						// log.debug("Found IPFS CID=" + pin + " on nodeId " +
						// ipfsNode.getId().toHexString());

						if (statsMap != null) {
							Long binSize = ipfsNode.getIntProp(NodeProp.BIN_SIZE.s());
							if (binSize == null) {
								// Note: If binTotal is ever zero here we SHOULD do what's in the comment above
								// an call objectStat to put correct amount in.
								binSize = 0L;
							}

							/*
							 * Make sure storage space for this IPFS node pin is built into user quota. NOTE: We could be more
							 * aggressive about 'correctness' here and actually call ipfs.objectStat on each CID, to get a more
							 * bullet proof total bytes amount, but we are safe enough trusting what the node info holds,
							 * becasue it should be correct.
							 */
							UserStats stats = statsMap.get(ipfsNode.getOwner());
							if (stats == null) {
								stats = new UserStats();
								stats.binUsage = binSize;
								statsMap.put(ipfsNode.getOwner(), stats);
							} else {
								stats.binUsage = stats.binUsage.longValue() + binSize;
							}
						}
					} else {
						// log.debug("Removing Orphan IPFS CID=" + pin);
						orphanCount++;
						ipfs.removePin(pin);
					}
				}
			}
			ret.setVal("Pins in use: " + pinCount + "\nOrphan Pins removed: " + orphanCount + "\n");
			log.debug(ret.getVal());
			return null;
		});
		return ret.getVal();
	}

	public void runRepairs(MongoSession session) {
		// not currently used
		// Query query = new Query();
		// query.addCriteria(Criteria.where(SubNode.FIELD_TYPE).is("u"));
		// Iterable<SubNode> iter = util.find(query);
		// for (SubNode n : iter) {
		// }
	}
}
