package quanta.service.imports;

import java.io.BufferedInputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import com.fasterxml.jackson.core.type.TypeReference;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.rest.request.ImportJsonRequest;
import quanta.rest.response.ImportJsonResponse;
import quanta.util.ExUtil;
import quanta.util.StreamUtil;
import quanta.util.Util;
import quanta.util.XString;

@Component
public class ImportService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(ImportService.class);

    /**
     * Streams an import of a file into a specified node.
     *
     * @param nodeId The ID of the target node where the file will be imported.
     * @param uploadFiles An array of MultipartFile objects to be imported. Only a single file is
     *        allowed.
     * @return ResponseEntity with HTTP status OK if the import is successful.
     * @throws RuntimeEx if the nodeId is not provided, the node is not found, the node has direct
     *         children, multiple files are provided, or the file type is unsupported.
     */
    public ResponseEntity<?> streamImport(String nodeId, MultipartFile[] uploadFiles) {
        MongoTranMgr.ensureTran();
        if (nodeId == null) {
            throw new RuntimeEx("target nodeId not provided");
        }
        SubNode node = svc_mongoRead.getNode(nodeId);
        if (node == null) {
            throw new RuntimeEx("Node not found.");
        }
        svc_auth.ownerAuth(node);

        // This is critical to be correct so we run the actual query based determination of 'hasChildren'
        boolean hasChildren = svc_mongoRead.directChildrenExist(node.getPath());
        if (hasChildren) {
            throw new RuntimeEx("You can only import into an empty node. There are direct children under path(a): "
                    + node.getPath());
        }

        /*
         * It's important to be sure there are absolutely no orphans at any level under this branch of the
         * tree, so even though the check above told us there are no direct children we still need to run
         * this recursive delete.
         */
        svc_mongoDelete.deleteUnderPath(node.getPath());
        if (uploadFiles.length != 1) {
            throw new RuntimeEx("Multiple file import not allowed");
        }
        MultipartFile uploadFile = uploadFiles[0];
        String fileName = uploadFile.getOriginalFilename();

        if (!StringUtils.isEmpty(fileName)) {
            log.debug("Uploading file: " + fileName);
            BufferedInputStream in = null;
            try {
                // Import ZIP files
                if (fileName.toLowerCase().endsWith(".zip")) {
                    log.debug("Import ZIP to Node: " + node.getPath());
                    in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));
                    ImportZipService impSvc = (ImportZipService) context.getBean(ImportZipService.class);
                    impSvc.importFromStream(in, node, false);
                    node.setHasChildren(true);
                    svc_mongoUpdate.saveSession();
                }
                // Import TAR files (non GZipped)
                else if (fileName.toLowerCase().endsWith(".tar")) {
                    log.debug("Import TAR to Node: " + node.getPath());
                    in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));
                    ImportTarService impSvc = (ImportTarService) context.getBean(ImportTarService.class);
                    impSvc.importFromStream(in, node, false);
                    node.setHasChildren(true);
                    svc_mongoUpdate.saveSession();
                }
                // Import TAR.GZ (GZipped TAR)
                else if (fileName.toLowerCase().endsWith(".tar.gz")) {
                    log.debug("Import TAR.GZ to Node: " + node.getPath());
                    in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));
                    ImportTarService impSvc = (ImportTarService) context.getBean(ImportTarService.class);
                    impSvc.importFromZippedStream(in, node, false);
                    node.setHasChildren(true);
                    svc_mongoUpdate.saveSession();
                } else {
                    throw new RuntimeEx("Only ZIP, TAR, TAR.GZ files are supported for importing.");
                }
            } catch (Exception ex) {
                throw new RuntimeEx(ex);
            } finally {
                StreamUtil.close(in);
            }
        }
        return new ResponseEntity<>(HttpStatus.OK);
    }

    /**
     * Imports JSON content into the system based on the provided request.
     *
     * Assumes the node identified in 'req' contains JSON we create a subgraph under the node that's a
     * representation of the JSON, with each key/value pair (and/or array content) in the JSON being a
     * node.
     * 
     * @param req the request containing the node ID and type for the import operation
     * @return an ImportJsonResponse containing the ID of the newly created node, if any
     */
    public ImportJsonResponse importJson(ImportJsonRequest req) {
        MongoTranMgr.ensureTran();
        ImportJsonResponse res = new ImportJsonResponse();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        svc_auth.ownerAuth(node);

        HashMap<String, Object> map = null;
        try {
            String content = XString.extractFirstJsonCodeBlock(node.getContent());

            map = Util.yamlMapper.readValue(content, new TypeReference<HashMap<String, Object>>() {});
            if (map != null) {
                SubNode newNode = null;
                if ("toc".equalsIgnoreCase(req.getType())) {
                    newNode = traverseToC(map, node, null);
                } else {
                    newNode = traverseMap(map, node, 0L, 0);
                }
                if (newNode != null) {
                    res.setNodeId(newNode.getIdStr());
                }
            }
        } catch (Exception e) {
            ExUtil.error(log, "failed parsing yaml", e);
        }

        // log.debug("Importing JSON for node: " + XString.prettyPrint(map));
        return res;
    }

    /**
     * Traverses a map representing a table of contents (ToC) and constructs a hierarchical structure of
     * nodes.
     * 
     * @param map A map containing the book's structure, including titles and chapters.
     * @param parentNode The parent node to which the book node will be added.
     * @param bookMasterPrompt An optional prompt providing the overall purpose of the book.
     * @return The root node of the constructed book hierarchy, or null if required data is missing.
     */
    public SubNode traverseToC(Map<String, Object> map, SubNode parentNode, String bookMasterPrompt) {
        String bookTitle = (String) map.get("title");
        if (bookTitle == null) {
            log.debug("toc node missing title");
            return null;
        }

        String systemPrompt =
                "You are an author helping me write a book. You will consider the Book Title, Chapter Title, Section Title and/or Subsection Titles provided, to understand which piece of the book you are writing, and generate content for that part of the book. If you are given further instructions in addition to the Book Title, Chapter Title, Section Title and/or Subsection Title, then follow those instructions, when you create the book content.";

        if (bookMasterPrompt != null) {
            systemPrompt +=
                    "\n\nBy the way, when you generate this content, keep in mind that the following was the overall purpose for the book:\n\nPURPOSE:\n"
                            + bookMasterPrompt;
        }

        SubNode bookNode = addJsonNode(parentNode, "# " + bookTitle, 0L, "#book", systemPrompt);

        List<?> chapters = (List<?>) map.get("chapters");
        if (chapters == null) {
            log.debug("toc node missing chapters");
            return null;
        }

        long chapterIdx = 0;
        for (Object chapter : chapters) {
            Map<?, ?> chapterMap = (Map<?, ?>) chapter;
            String chapterTitle = (String) chapterMap.get("title");
            if (chapterTitle == null) {
                log.debug("toc chapter missing title");
                continue;
            }
            SubNode chapterNode = addJsonNode(bookNode, "## " + chapterTitle, chapterIdx * 1000, "#chapter", null);
            List<?> sections = (List<?>) chapterMap.get("sections");
            if (sections == null) {
                log.debug("toc chapter missing sections");
                continue;
            }

            long sectionIdx = 0;
            for (Object section : sections) {
                if (section instanceof String) {
                    addJsonNode(chapterNode, (String) "### " + section, 0L, "#section", null);
                }
                // todo-2: haven't tested subsections yet, and we also may not ever really need to go this
                // deep in the hierarchy, and our prompt to generate the ToC doesn't even mention subsections
                // either.
                else if (section instanceof Map sectionMap) {
                    String sectionTitle = (String) sectionMap.get("title");
                    if (sectionTitle == null) {
                        log.debug("toc section missing title");
                        continue;
                    }
                    SubNode sectionNode =
                            addJsonNode(chapterNode, "### " + sectionTitle, sectionIdx * 1000, "#section", null);

                    List<?> subsections = (List<?>) sectionMap.get("subsections");
                    if (subsections == null) {
                        log.debug("toc section missing subsections");
                        continue;
                    }

                    long subSectionIdx = 0;
                    for (Object subsection : subsections) {
                        if (subsection instanceof String) {
                            addJsonNode(sectionNode, (String) "#### " + subsection, subSectionIdx * 1000, "#subsection",
                                    null);
                        } else {
                            log.debug("toc subsection not a string");
                        }
                        subSectionIdx++;
                    }
                } else {
                    log.debug("toc section not a string or map");
                }
                sectionIdx++;
            }
            chapterIdx++;
        }
        return bookNode;
    }

    /**
     * Traverses a map and creates a hierarchical structure of SubNode objects.
     *
     * @param map The map to traverse. Can contain nested maps and lists.
     * @param parentNode The parent node to which the new nodes will be added.
     * @param ordinal The ordinal value for ordering the nodes.
     * @param level The current level of traversal, used for recursion depth.
     * @return The newly created SubNode that represents the root of the traversed map.
     */
    public SubNode traverseMap(Map<?, ?> map, SubNode parentNode, Long ordinal, int level) {
        if (map == null)
            return null;

        StringBuilder sb = new StringBuilder();
        SubNode newNode = addJsonNode(parentNode, "", ordinal, null, null);
        Long childOrdinal = 0L;

        for (Map.Entry<?, ?> entry : map.entrySet()) {
            Object value = entry.getValue();

            if (value instanceof String) {
                sb.append(entry.getKey() + ": " + value + "\n\n");
            } else if (value instanceof HashMap) {
                // If we have a nested HashMap, recursively traverse it
                traverseMap((HashMap<?, ?>) value, newNode, childOrdinal, level + 1);
            } else if (value instanceof List) {
                // If we have a List, iterate over it and recursively traverse any Maps or Lists within
                traverseList((List<?>) value, newNode, childOrdinal, level + 1, false);
            } else {
                log.debug("json map type not handled: " + value.getClass().getName());
            }
            childOrdinal += 1000;
        }

        newNode.setContent(sb.toString());
        svc_mongoUpdate.save(newNode);
        return newNode;
    }

    /**
     * Traverses a list and processes its elements, creating hierarchical nodes as needed.
     *
     * @param list the list to traverse
     * @param parentNode the parent node to which new nodes will be added
     * @param ordinal the ordinal position for the nodes
     * @param level the current level of traversal
     * @param listInList flag indicating if the current list is nested within another list
     */
    private void traverseList(List<?> list, SubNode parentNode, Long ordinal, int level, boolean listInList) {
        if (list == null)
            return;

        // if this is a list inside a list, we need to create a new node to represent the list, so we have
        // correct hierarchy
        if (listInList) {
            parentNode = addJsonNode(parentNode, "list...", ordinal, null, null);
        }

        ordinal = 0L;
        for (Object element : list) {
            if (element instanceof String elementStr) {
                addJsonNode(parentNode, elementStr, ordinal, null, null);
            } else if (element instanceof HashMap) {
                // If we have a nested HashMap, recursively traverse it
                traverseMap((HashMap<?, ?>) element, parentNode, ordinal, level + 1);
            } else if (element instanceof List) {
                // If we have a nested List, recursively traverse it
                traverseList((List<?>) element, parentNode, ordinal, level + 1, true);
            } else {
                log.debug("json list type not handled: " + element.getClass().getName());
            }
            ordinal += 1000;
        }
    }

    /**
     * Adds a new JSON node as a child of the specified parent node.
     *
     * @param parentNode The parent node to which the new node will be added.
     * @param content The content to be set for the new node.
     * @param ordinal The ordinal position of the new node.
     * @param tag An optional tag to be set for the new node. Can be null.
     * @param aiSystemPrompt An optional AI system prompt to be set for the new node. Can be null.
     * @return The newly created SubNode.
     */
    private SubNode addJsonNode(SubNode parentNode, String content, Long ordinal, String tag, String aiSystemPrompt) {
        SubNode newNode =
                svc_mongoCreate.createNode(parentNode, null, null, ordinal, CreateNodeLocation.LAST, false, null);
        newNode.setContent(content);
        newNode.setAc(parentNode.getAc());
        newNode.touch();

        if (tag != null) {
            newNode.setTags(tag);
        }

        if (aiSystemPrompt != null) {
            newNode.set(NodeProp.AI_PROMPT, aiSystemPrompt);
        }

        svc_mongoUpdate.save(newNode); // save right away so we get path and ID
        return newNode;
    }
}
