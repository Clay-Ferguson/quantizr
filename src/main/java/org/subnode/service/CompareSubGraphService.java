package org.subnode.service;

import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

/**
 * Recurses into two separate tree subgraphs to see if the two trees are identical or not, possibly
 * ignoring certain things like timestamp, etc.
 */
@Component
@Scope("prototype")
public class CompareSubGraphService {
	// private static final Logger log = LoggerFactory.getLogger(CompareSubGraphService.class);
	//
	// public void compare(Session session, CompareSubGraphRequest req, CompareSubGraphResponse res)
	// {
	// if (session == null) {
	// session = ThreadLocals.getJcrSession();
	// }
	//
	// String nodeIdA = req.getNodeIdA();
	// String nodeIdB = req.getNodeIdB();
	//
	// /* validate nodes IDs were sent */
	// if (StringUtils.isEmpty(nodeIdA) || StringUtils.isEmpty(nodeIdB)) {
	// throw new RuntimeEx("Must specify two nodes to compare.");
	// }
	//
	// nodeIdA = nodeIdA.trim();
	// nodeIdB = nodeIdB.trim();
	//
	// if (nodeIdA.equals(nodeIdB)) {
	// throw new RuntimeEx("Cannot compare node to itself. Please supply two different nodes.");
	// }
	//
	// /*
	// * todo-1: if we wanted to we could also run a search to be sure none of the parent nodes of
	// * A is B, and vice versa just for one more sanity check before we start processing to be
	// * sure user doesn't have a case where A is a SubGraph of B or vice versa
	// */
	//
	// boolean success = false;
	// try {
	// Node nodeA = JcrUtil.findNode(session, nodeIdA);
	// Node nodeB = JcrUtil.findNode(session, nodeIdB);
	// recurseNode(nodeA, nodeB);
	// res.setCompareInfo("Nodes are identical.");
	// success = true;
	// }
	// /*
	// * This exception is how we detect that the SubGraphs are not equal and report back to the
	// * user. This is more of a normal flow than an error condition.
	// */
	// catch (CompareFailedException ex) {
	// String compareInfo = "Compare Failed: " + ex.getMessage();
	// log.debug("Compare Failed", ex);
	// res.setCompareInfo(compareInfo);
	// success = true;
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	//
	// /*
	// * Success here indicates nothing failed about how the compare was done, and is not the same
	// * as saying the nodes are identical or not.
	// */
	// res.setSuccess(success);
	// }
	//
	// private void recurseNode(Node nodeA, Node nodeB) {
	// if (nodeA == null || nodeB == null) return;
	//
	// try {
	// /* process the current node */
	// processNode(nodeA, nodeB);
	//
	// /* then recursively process all children of the current node */
	// NodeIterator nodeIterA, nodeIterB;
	// try {
	// nodeIterA = JcrUtil.getNodes(nodeA);
	// nodeIterB = JcrUtil.getNodes(nodeB);
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	//
	// int oddEven = 0;
	// try {
	// while (true) {
	// Node nA = nodeIterA.nextNode();
	// oddEven++;
	// Node nB = nodeIterB.nextNode();
	// oddEven++;
	// recurseNode(nA, nB);
	// }
	// }
	// catch (NoSuchElementException ex) {
	// // not an error. Normal iterator end condition.
	// // but we check oddEven to verify child counts were identical.
	// if (oddEven % 2 != 0) {
	// throw new CompareFailedException("child nodes are not same count");
	// }
	// }
	// }
	// catch (Exception e) {
	// throw ExUtil.newEx(e);
	// }
	// }
	//
	// private void processNode(Node nodeA, Node nodeB) {
	// try {
	// // log.debug("Processing NodeA: " + nodeA.getPath() + " ident: " +
	// // nodeA.getIdentifier());
	// // log.debug("Processing NodeB: " + nodeB.getPath() + " ident: " +
	// // nodeB.getIdentifier());
	//
	// /* Get ordered set of property names. Ordering is significant for SHA256 obviously */
	// List<String> propNamesA = JcrUtil.getPropertyNames(nodeA, true);
	// List<String> propNamesB = JcrUtil.getPropertyNames(nodeB, true);
	//
	// propNamesA = removeIgnoredProps(propNamesA);
	// propNamesB = removeIgnoredProps(propNamesB);
	//
	// // jcr:uuid is a fly in ointment here when you have done an IMPORT of a node that was
	// // "renamed" and thus is referencable
	// // and has jcr:uuid on it.
	//
	// // verify propNames lists identical
	// if (!propNamesA.equals(propNamesB)) {
	// throw new CompareFailedException("Property count difference detected.");
	// }
	//
	// for (String propName : propNamesA) {
	// /* get this property value on both nodes */
	// Property propA = nodeA.getProperty(propName);
	// Property propB = nodeB.getProperty(propName);
	//
	// /* verify property data is identical */
	// compareProperties(propName, propA, propB);
	// }
	//
	// /*
	// * Check primary node types identical. todo-1: we can add mix-ins, to be more strict
	// * about the definition of truely identical types
	// */
	// String typeA = nodeA.getPrimaryNodeType().getName();
	// String typeB = nodeB.getPrimaryNodeType().getName();
	//
	// if (!typeA.equals(typeB)) {
	// throw new CompareFailedException("types mismatched.");
	// }
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	// }
	//
	// private List<String> removeIgnoredProps(List<String> list) {
	// return list.stream().filter(item -> !ignoreProperty(item)).collect(Collectors.toList());
	// }
	//
	// /*
	// * todo-1: For verification of import/export we need to ignore these, but for DB replication
	// in
	// * P2P we wouldn't
	// */
	// private boolean ignoreProperty(String propName) {
	// return JcrProp.CREATED.equals(propName) || //
	// JcrProp.LAST_MODIFIED.equals(propName) || //
	// JcrProp.CREATED_BY.equals(propName) || //
	// JcrProp.UUID.equals(propName) || //
	// JcrProp.BIN_VER.equals(propName);
	// }
	//
	// private void compareProperties(String propName, Property propA, Property propB) {
	// try {
	// if (!propA.getName().equals(propB.getName())) {
	// throw new RuntimeEx("bug in compare code. Property names different.");
	// }
	//
	// /* multi-value */
	// if (propA.isMultiple()) {
	// if (!propB.isMultiple()) {
	// throw new CompareFailedException("multiplicity difference: " + propName);
	// }
	//
	// Value[] vA = propA.getValues();
	// Value[] vB = propB.getValues();
	// compareValArrays(propName, vA, vB);
	// }
	// /* single valued property */
	// else {
	// if (propName.equals(JcrProp.BIN_DATA)) {
	// if (!StreamUtil.streamsIdentical(propA.getValue().getBinary().getStream(),
	// propB.getValue().getBinary().getStream())) {
	// throw new CompareFailedException("binary data did not match.");
	// }
	// }
	// else {
	// compareVals(propName, propA.getValue(), propB.getValue());
	// }
	// }
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	// }
	//
	// private void compareValArrays(String propName, Value[] vA, Value[] vB) {
	// if (vA.length != vB.length) {
	// throw new CompareFailedException("multi value count mismatch: propName=" + propName);
	// }
	//
	// for (int i = 0; i < vA.length; i++) {
	// compareVals(propName, vA[i], vB[i]);
	// }
	// }
	//
	// private void compareVals(String propName, Value valueA, Value valueB) {
	// try {
	// if (!valueA.getString().equals(valueB.getString())) {
	// throw new CompareFailedException("values compare failed: propName=" + propName + "\n A=" +
	// valueA.getString() + "\n B=" + valueB.getString());
	// }
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	// }
}
