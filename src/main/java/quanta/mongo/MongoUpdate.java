package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.UserStats;
import quanta.model.client.NodeProp;
import quanta.mongo.model.SubNode;
import quanta.util.Cast;
import quanta.util.ThreadLocals;
import quanta.util.Val;
import quanta.util.XString;

/**
 * Performs update (as in CRUD) operations for MongoDB
 */
@Component
public class MongoUpdate extends ServiceBase  {
	private static final Logger log = LoggerFactory.getLogger(MongoUpdate.class);

	@Autowired
    public MongoTemplate ops;


	// NOTE: Since this is a threadlocal we have no concurrency protection (not needed)
	private static final ThreadLocal<Boolean> saving = new ThreadLocal<>();

	@PostConstruct
	public void postConstruct() {
		update = this;
	}

	public void saveObj(Object obj) {
		ops.save(obj);
	}

	public void save(MongoSession ms, SubNode node) {
		save(ms, node, true);
	}

	public void save(MongoSession ms, SubNode node, boolean allowAuth) {
		if (allowAuth) {
			auth.ownerAuth(ms, node);
		}
		// log.debug("MongoApi.save: DATA: " + XString.prettyPrint(node));

		// if not doing allowAuth, we need to be sure the thread has admin session
		// so the MongoEventListener can allow all access.
		if (!allowAuth) {
			arun.run(as -> {
				ops.save(node);
				return null;
			});
		} else {
			ops.save(node);
		}
		ThreadLocals.clean(node);
	}

	public void saveSession(MongoSession ms) {
		saveSession(ms, false);
	}

	private boolean isSaving() {
		return ok(saving.get()) && saving.get().booleanValue();
	}

	public void saveSession(MongoSession ms, boolean asAdmin) {
		if (no(ms) || isSaving() || !ThreadLocals.hasDirtyNodes())
			return;

		try {
			// we check the saving flag to ensure we don't go into circular recursion here.
			saving.set(true);

			synchronized (ms) {
				/*
				 * We use 'nodes' list to avoid a concurrent modification, because calling 'save()' on a node
				 * will have the side effect of removing it from dirtyNodes, and that can't happen during
				 * the loop below because we're iterating over dirtyNodes.
				 */
				List<SubNode> nodes = new LinkedList<>();

				/*
				 * check that we are allowed to write all, before we start writing any
				 */
				for (SubNode node : ThreadLocals.getDirtyNodes().values()) {

					/*
					 * If we're not running this as admin user we have to auth to be sure we're allowed to save this
					 * node
					 */
					if (!asAdmin) {
						try {
							auth.ownerAuth(ms, node);
						} catch (Exception e) {
							log.debug("Dirty node save attempt failed: " + XString.prettyPrint(node));
							log.debug("Your mongoSession has user: " + ms.getUserName() + //
									" and your ThreadLocal session is: " + ThreadLocals.getSC().getUserName());
							throw e;
						}
					}
					nodes.add(node);
				}

				for (SubNode node : nodes) {
					// log.debug("saveSession: Saving Dirty. nodeId=" + (node.getId()==null ? "null
					// (new node?)" : node.getIdStr()));
					save(ms, node, false);
				}

				/*
				 * This theoretically should never find any dirty nodes, because we just saved them all but we
				 * definitely still want this line of code here
				 */
				ThreadLocals.clearDirtyNodes();
			}
		} finally {
			saving.set(false);
		}
	}

	/*
	 * Unpins any IPFS data that is not currently referenced by MongoDb. Cleans up orphans.
	 */
	public String releaseOrphanIPFSPins(HashMap<ObjectId, UserStats> statsMap) {
		Val<String> ret = new Val<>("failed");
		arun.run(as -> {
			int pinCount = 0, orphanCount = 0;
			LinkedHashMap<String, Object> pins = Cast.toLinkedHashMap(ipfs.getPins());
			if (ok(pins)) {
				/*
				 * For each CID that is pinned we do a lookup to see if there's a Node that is using that PIN, and
				 * if not we remove the pin
				 */
				for (String pin : pins.keySet()) {
					SubNode ipfsNode = read.findByIPFSPinned(as, pin);
					if (ok(ipfsNode)) {
						pinCount++;
						// log.debug("Found IPFS CID=" + pin + " on nodeId " +
						// ipfsNode.getIdStr());

						if (ok(statsMap)) {
							Long binSize = ipfsNode.getInt(NodeProp.BIN_SIZE);
							if (no(binSize)) {
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
							if (no(stats)) {
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

	public void runRepairs(MongoSession ms) {
		// not currently used
		// Query query = new Query();
		// query.addCriteria(Criteria.where(SubNode.FIELD_TYPE).is("u"));
		// Iterable<SubNode> iter = util.find(query);
		// for (SubNode n : iter) {
		// }
	}
}
