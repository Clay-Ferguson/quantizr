package org.subnode.service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.subnode.config.NodePrincipal;
import org.subnode.model.FileSyncStats;
import org.subnode.model.MetaDirInfo;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.request.FileSystemReindexRequest;
import org.subnode.response.FileSystemReindexResponse;
import org.subnode.util.DateUtil;
import org.subnode.util.FileTools;
import org.subnode.util.FileUtils;
import org.subnode.util.RuntimeEx;
import org.subnode.util.XString;

import org.apache.commons.lang3.ArrayUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * WARNING: after refactor involving moving content into SubNode as a direct property
 * this code was not yet updated to acount for that.
 * 
 * TODO: add live updating, we can add the JavaWatch service
 * https://www.baeldung.com/java-nio2-watchservice
 * 
 * Syncs content between a node and a server-side File System, so that SubNode
 * can be used to browse and edit files directly on a filesystem.
 * 
 * During this sync it's one-directional biased FROM the filesystem INTO SubNode
 * database. However, we do support allowing certain text files to be edited,
 * but when edited, the changes made are written back out to the file as well.
 * If any file content on the filesystem ever gets updated outside from the
 * knowledge of Quantizr app, then the app is smart enough to know to import the
 * filesystem content of that file back into subnode. That is, when there's a
 * difference between two files the filesystem wins.
 * 
 * As SubNode encounters files on the filesystem, it loads their content
 * into SubNode which then is essentially a 'cache' of all the filesystem data,
 * and can also be searched using the full power of the MongoDB-provided 
 * 'full text' search capability.
 */
@Component
public class FileSyncService {
	private static final Logger log = LoggerFactory.getLogger(FileSyncService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private AllSubNodeTypes TYPES;

	@Autowired
	private FileUtils fileUtils;

	/**
	 * Reindexes the entire subtree (recursive) at and under the node id specified.
	 */
	public FileSyncStats fileSystemReindex(MongoSession session, FileSystemReindexRequest req,
			FileSystemReindexResponse res) {
		log.debug("Reindex: " + req.getNodeId());
		SubNode node = api.getNode(session, req.getNodeId());
		api.authRequireOwnerOfNode(session, node);
		FileSyncStats stats = new FileSyncStats();
		syncFolder(session, node, true, stats);
		res.setSuccess(true);
		String statsReport = genStatsReport(stats);
		res.setReport(statsReport);
		return stats;
	}

	/**
	 * Creates a printable representation of FileSyncStats
	 */
	private String genStatsReport(FileSyncStats stats) {
		StringBuilder sb = new StringBuilder();
		addStat(sb, "File Nodes Created", stats.fileNodesCreated);
		addStat(sb, "Folder Nodes Created", stats.folderNodesCreated);
		addStat(sb, "Max Folder Depth", stats.maxFolderDepth);
		addStat(sb, "Folder Count", stats.folderCount);
		addStat(sb, "File Count", stats.fileCount);
		addStat(sb, "Updated Files", stats.updatedFiles);
		addStat(sb, "Num Deleted Folder Nodes", stats.numDeletedFolderNodes);
		addStat(sb, "Num Deleted File Nodes", stats.numDeletedFileNodes);
		return sb.toString();
	}

	/**
	 * Adds a single stat to stringbuilder. Abstracts out any formatting.
	 */
	private void addStat(StringBuilder sb, String statName, long value) {
		sb.append(statName);
		sb.append(": ");
		sb.append(String.valueOf(value));
		sb.append("\n");
	}

	/*
	 * Main entry point to perform a sync of 'node' against the local file system.
	 * This also re-executes any time a node is being rendered that is synced to
	 * filesystem, to ensure info is up to date with filesystem.
	 */
	public void syncFolder(MongoSession session, SubNode node, boolean recursive, FileSyncStats stats) {
		Objects.requireNonNull(node);

		/* FS_LINK nodes must be owned by 'admin' in order to be allowed to function */
		// todo-2: Don't we have a dedicated exception for this?
		if (!NodePrincipal.ADMIN.equals(api.getNodeOwner(session, node))) {
			throw new RuntimeException("unauthorized");
		}

		if (!isSyncableNode(session, node)) {
			throw new RuntimeException("Not a syncable node.");
		}

		if (stats == null) {
			stats = new FileSyncStats();
		}

		/* Do the actual sync of the folder */
		processSync(session, node, recursive, 0, stats);
	}

	/**
	 * Innermost internal method for syncing a node to filesystem
	 */
	private void processSync(MongoSession session, SubNode node, boolean recursive, int level, FileSyncStats stats) {
		if (node == null) {
			return;
		}

		if (level > stats.maxFolderDepth) {
			stats.maxFolderDepth = level;
		}

		String folderToSync = node.getStringProp(TYPES.FS_LINK);

		log.debug("Syncing Folder[LEVEL=" + String.valueOf(level) + "]: " + node.getPath() + " to folder: "
				+ folderToSync);

		File[] folders = fileUtils.getSortedListOfFolders(folderToSync, null);
		File[] files = fileUtils.getSortedListOfFiles(folderToSync, null);

		stats.folderCount += folders != null ? folders.length : 0;
		stats.fileCount += files != null ? files.length : 0;

		/*
		 * Now put folders and files all in one combined list, with files at top and
		 * folders all at bottom
		 */
		File[] filesAndFolders = (File[]) ArrayUtils.addAll(files, folders);

		/*
		 * We check for a file named .meta-fs and if so load it as json into
		 * MetaDirInfo, and that will allow us to control both the ordering of the
		 * files/folders and also determines which files/folders to include in the scan
		 */
		MetaDirInfo metaDirInfo = readMetaDirInfo(files);

		// Holds each 'file' found in metaDirInfo in a LinkedHashMap.
		LinkedHashMap<String, Object> metaDirNames = null;

		// loop thru json content to load 'metaDirNames'
		if (metaDirInfo != null) {
			metaDirNames = new LinkedHashMap<String, Object>();
			for (String file : metaDirInfo.getFiles()) {
				//log.debug("META: " + file);
				metaDirNames.put(file, "");
			}
		}

		/* build up a hashmap of all the File objects keyed by filename */
		HashMap<String, File> fileMap = new HashMap<String, File>();

		/* Load map of Files (files and folders) keyed on fileName */
		if (filesAndFolders != null) {
			for (File file : filesAndFolders) {
				String fileName = file.getName();
				String type = file.isFile() ? "file" : "folder";
				log.debug("    fileMap->" + type + " item: [" + fileName + "]");

				if (metaDirNames == null || metaDirNames.containsKey(fileName)) {
					fileMap.put(fileName, file);
				}
				else {
					log.debug("    fileMap Ignore: "+fileName);
				}
			}
		}

		File[] filteredFilesAndFolders = null;

		// if metaDirInfo is null we don't do any actual filtering/ordering
		if (metaDirInfo == null) {
			filteredFilesAndFolders = filesAndFolders;
		} else {
			final File[] _filteredFilesAndFolders = new File[metaDirNames.size()];
			int idx[] = new int[1];

			metaDirNames.keySet().forEach(name -> {
				File file = fileMap.get(name);
				if (file == null) {
					throw new RuntimeException("Failed to find name: " + name);
				}
				_filteredFilesAndFolders[idx[0]++] = file;
			});

			filteredFilesAndFolders = _filteredFilesAndFolders;
		}

		/*
		 * build up a hashmap of all the SubNode objects keyed by filename, by scanning
		 * the children currently under the node that is being synced
		 */
		HashMap<String, SubNode> nodeMap = new HashMap<String, SubNode>();
		Iterable<SubNode> iter = api.getChildren(session, node, false, 10000);
		List<SubNode> nodesToDelete = new LinkedList<SubNode>();
		for (SubNode child : iter) {
			String fullFileName = child.getStringProp(TYPES.FS_LINK);

			if (fullFileName != null) {
				File obj = new File(fullFileName);

				/*
				 * If this node points to a filesystem link that either doesn't exist or is the
				 * wrong type of thing (file v.s. folder)
				 */
				if (!obj.exists() || //
						(obj.isFile() && !child.isType(TYPES.FS_FILE)) || //
						(obj.isDirectory() && !child.isType(TYPES.FS_FOLDER))) {
					log.debug("Node at path " + child.getPath() + " will be deleted. Has wrong file system link: "
							+ fullFileName);

					if (child.isType(TYPES.FS_FOLDER)) {
						stats.numDeletedFolderNodes++;
					} else if (child.isType(TYPES.FS_FILE)) {
						stats.numDeletedFileNodes++;
					}

					nodesToDelete.add(child);
				} else {
					String name = fileUtils.getShortFileName(fullFileName);
					nodeMap.put(name, child);
					log.debug("nodeMap->shortFileName=: " + name);
				}
			} else {
				/*
				 * If this node is missing propert link property we blow it away. Nothing under
				 * a folder node is allowed to exist except for true filesystem nodes (files and
				 * folders)
				 */
				nodesToDelete.add(child);
			}
		}

		boolean nodesDeleted = false;
		if (!nodesToDelete.isEmpty()) {
			nodesDeleted = true;
			for (SubNode delNode : nodesToDelete) {
				api.delete(session, delNode);
			}
		}

		/*
		 * First, scan all files/folders and for any that don't have an existing
		 * SubNode, create the SubNode, and for files/folders where we have a node
		 * alread update the node using the filesystem.
		 */
		long ordinal = 1;
		if (filteredFilesAndFolders != null) {
			for (File file : filteredFilesAndFolders) {
				String fileName = file.getName();
				SubNode fileNode = null;
				boolean save = false;

				/* If there's no node existing for this filename */
				if (!nodeMap.containsKey(fileName)) {
					fileNode = createNodeForFileSystemItem(session, node, file, ordinal, stats);
					nodeMap.put(file.getName(), fileNode);
					save = true;
				}
				/*
				 * Else if we have a node for this file, then verify the node is up to date by
				 * checking last mod time.
				 */
				else {
					fileNode = nodeMap.get(fileName);
					log.debug("Node existed for FS resource: " + fileName);

					String curFsType = file.isDirectory() ? TYPES.FS_FOLDER.getName() : TYPES.FS_FILE.getName();

					/*
					 * it's possible for a name to be changing from file to folder, or vise versa.
					 * Support that.
					 */
					if (!curFsType.equals(fileNode.getType())) {
						fileNode.setType(curFsType);
						save = true;
					}

					/*
					 * If this is a file and it has been modified (i.e. lastmod time changed) then
					 * we need to update the mod time and also read in the file if it's one we can
					 * edit/display
					 */
					if (curFsType.equals(TYPES.FS_FILE.getName())) {
						if (readContentIfTimestampChanged(file, fileNode, stats)) {
							save = true;
						}
					}

					/* Set the link property if it's not exacty what it should be */
					String curLink = fileNode.getStringProp(TYPES.FS_LINK);
					if (!curLink.equals(file.getAbsolutePath())) {
						fileNode.setProp(TYPES.FS_LINK, file.getAbsolutePath());
						save = true;
					}

					/*
					 * if node exists check ordinal and update if it's changed. File system sort
					 * order overrides/controls node ordinals
					 */
					if (!fileNode.getOrdinal().equals(ordinal)) {
						fileNode.setOrdinal(ordinal);
						save = true;
					}
				}

				if (fileNode != null && save) {
					api.save(session, fileNode);
				}
				ordinal++;
			}
		}

		List<String> keysToDelete = new LinkedList<String>();
		/*
		 * And finally we clean out orphaned nodes. Any nodes that exist in SubNode DB
		 * for which there is no longer an associate file/folder on the filesystem get
		 * deleted. Filesystem is the source of truth here so if there's no filesystem
		 * file there's no node, and if anefilesystem folder has been deleted then we
		 * also delete that node (branch oethe tree) in SubNode DB
		 */
		for (Map.Entry<String, SubNode> entry : nodeMap.entrySet()) {
			String name = entry.getKey();
			SubNode fileNode = entry.getValue();

			String fullFileName = fileNode.getStringProp(TYPES.FS_LINK);

			/*
			 * Technically this check for existence is not needed if the above code worked
			 * flawlessly but for now i'm being paranoid and going ahead and checking for
			 * the actual file
			 */
			if (!fileMap.containsKey(name) || !fileUtils.fileOrFolderExists(fullFileName)) {
				// log.debug("Deleted node because LINK specified doesn't point to an actual
				// file/folder.");
				api.delete(session, fileNode);

				if (fileNode.isType(TYPES.FS_FOLDER)) {
					stats.numDeletedFolderNodes++;
				} else if (fileNode.isType(TYPES.FS_FILE)) {
					stats.numDeletedFileNodes++;
				}

				keysToDelete.add(name);
				nodesDeleted = true;
			} //
			else {
				// log.debug("NON-ORPHAN: "+name);
			}
		}

		/* remove all keysToDelete, from map */
		for (String key : keysToDelete) {
			nodeMap.remove(key);
		}

		// todo-p0: see if we can combine both api.saveSession calls into just one at
		// the end.
		if (nodesDeleted) {
			api.saveSession(session);
		}

		if (recursive && folders != null) {
			for (File folder : folders) {
				SubNode folderNode = nodeMap.get(folder.getName());
				if (folderNode == null) {
					throw new RuntimeException("folder.getName " + folder.getName() + " wasn't found in nodeMap");
				}
				processSync(session, folderNode, recursive, level + 1, stats);
			}
		}
	}

	private MetaDirInfo readMetaDirInfo(File[] files) {
		MetaDirInfo ret = null;
		for (File file : files) {
			if (file.getName().equalsIgnoreCase(".meta-fs")) {
				String json = FileUtils.readFile(file);
				if (json != null) {
					try {
						ret = XString.jsonMapper.readValue(json, MetaDirInfo.class);
					} catch (Exception e) {
						log.error("Failed parsing json.", e);
					}
				}
			}
		}
		return ret;
	}

	/**
	 * Updates fileNode content text and timestamps against file, and returns true
	 * if this node was updated and needs to be saved
	 */
	private boolean readContentIfTimestampChanged(File file, SubNode fileNode, FileSyncStats stats) {
		boolean changed = false;

		if (file.lastModified() != fileNode.getModifyTime().getTime()) {
			fileNode.setModifyTime(new Date(file.lastModified()));
			// log.debug("mod time upated: " + (new Date(file.lastModified()).toString()));
			changed = true;
		} else {
			// log.debug("mod time matched: " + (new Date(file.lastModified()).toString()));
		}

		long createTime = fileUtils.getFileCreateTime(file);
		if (createTime != fileNode.getCreateTime().getTime()) {
			fileNode.setCreateTime(new Date(createTime));
			// log.debug("create time upated: " + (new Date(createTime).toString()));

			/*
			 * Even if it was only perhaps the create time that somehow got changed we still
			 * take that as a hint that something might have changed in the file and we read
			 * the file to be sure
			 */
			changed = true;
		} else {
			// log.debug("create time matched: " + (new Date(createTime).toString()));
		}

		if (changed) {
			stats.updatedFiles++;
			/* If this is a type of file we can edit, then read in it's content */
			if (fileUtils.isEditableFile(file.getName())) {
				fileNode.setContent(FileUtils.readFile(file.getAbsolutePath()));
			}
		}
		return changed;
	}

	/**
	 * Creates a new node when we detect a file or folder is not yet represented in
	 * the database, and fully updates this node to match what is on the filesystem
	 */
	public SubNode createNodeForFileSystemItem(MongoSession session, SubNode parentNode, File file, long ordinal,
			FileSyncStats stats) {
		String fileName = file.getName();
		log.debug("Creating node for FS resource: " + fileName);

		boolean isDir = file.isDirectory();
		String type = file.isDirectory() ? TYPES.FS_FOLDER.getName() : TYPES.FS_FILE.getName();
		SubNode fileNode = api.createNode(session, parentNode.getPath() + "/" + fileName, type);

		if (stats != null) {
			if (isDir) {
				stats.folderNodesCreated++;
			} else {
				stats.fileNodesCreated++;
			}
		}

		if (!isDir) {
			/*
			 * If file is editable (based on filename extension) then we load the actual
			 * content of the file into the SubNode database, which is basically caching it,
			 * and also causes it to become full-text searchable
			 */
			if (fileUtils.isEditableFile(file.getName())) {
				fileNode.setContent(FileUtils.readFile(file.getAbsolutePath()));
			}
		}

		fileNode.setProp(TYPES.FS_LINK, file.getAbsolutePath());

		/*
		 * Setting the ordinal, here controls order of display in the SubNode gui same
		 * as what we want with the sorting done above
		 */
		fileNode.setOrdinal(ordinal);

		setTimeAttrsFromFile(fileNode, file);
		return fileNode;
	}

	/**
	 * Sets the timestamps on this node to match the filesystem entry
	 */
	public void setTimeAttrsFromFile(SubNode node, File file) {
		try {
			BasicFileAttributes attr = Files.readAttributes(file.toPath(), BasicFileAttributes.class);
			node.setModifyTime(new Date(attr.lastModifiedTime().toMillis()));
			node.setCreateTime(new Date(attr.creationTime().toMillis()));
			// System.out.println("lastAccessTime: " + attr.lastAccessTime());
		} catch (Exception e) {
			Date now = new Date();
			node.setModifyTime(now);
			node.setCreateTime(now);
		}
	}

	/**
	 * Returns true if this is a type of node that can be synced to the filesystem.
	 */
	public boolean isSyncableNode(MongoSession session, SubNode node) {
		return node.isType(TYPES.FS_FOLDER);
	}

	/**
	 * i think this is a redundant method. need to consolidate
	 */
	public void updateFromFileSystem(MongoSession session, SubNode node) {
		if (!node.isType(TYPES.FS_FILE)) {
			throw new RuntimeEx("Attempted to update non file type from file system.");
		}

		log.debug("Update From FileSystem: node.path=" + node.getPath());

		String fullFileName = node.getStringProp(TYPES.FS_LINK.getName());
		File file = new File(fullFileName);

		// todo-p1: There's code elswhere in this file which checks date and reads file
		// in if necessary. Should we combine all this logic into one method?
		if (file.lastModified() != node.getModifyTime().getTime()) {
			node.setModifyTime(new Date(file.lastModified()));

			/* If this is a type of file we can edit, then read in it's content */
			if (fileUtils.isEditableFile(file.getName())) {
				node.setContent(FileUtils.readFile(file.getAbsolutePath()));
			}

			api.save(session, node);
		}
	}

	/**
	 * When user edits a node using the web interface (i.e. this app!) then and it's
	 * a filetype (i.e a file node), then we write out the content to the file.
	 * 
	 * We also support ability to "edit" a folder, because folders have a special
	 * convention of having their 'content' in whatever file under that folder has
	 * same name as folder and a '.md' extension.
	 */
	public void saveNodeEditing(MongoSession session, SubNode node) {
		String fullFileName = node.getStringProp(TYPES.FS_LINK.getName());
		String content = node.getContent();
		File file = new File(fullFileName);

		if (node.isType(TYPES.FS_FILE)) {
			// log.debug("Saving content to file: " + fullFileName + " content=" + content);
			FileTools.writeEntireFile(fullFileName, content);
			node.setModifyTime(new Date(file.lastModified()));
		}

		api.save(session, node);
	}

	/**
	 * Deletes just the filesystem element that goes with this node. Deletes a file,
	 * or else a folder.
	 */
	public boolean delete(MongoSession session, SubNode node) {
		String fullFileName = node.getStringProp(TYPES.FS_LINK.getName());
		if (fullFileName == null) {
			return true;
		}
		if (fullFileName.length() < 10) {
			throw new RuntimeException("filename " + fullFileName + " is suspiciously too short to delete.");
		}
		File file = new File(fullFileName);
		boolean result = org.springframework.util.FileSystemUtils.deleteRecursively(file);
		return result;
	}

	/**
	 * This is a user-initiated request to create a new filesystem file
	 */
	public SubNode createFileUnderParent(MongoSession session, SubNode node) {
		String fullFileName = node.getStringProp(TYPES.FS_LINK);
		// todo-p2: Need to check first if all files in the parent folder are numbered
		// and only do this zero prefix if they are
		String newFileName = fullFileName + "/00000-new-file-" + DateUtil.getFileNameCompatDate() + ".md";
		FileTools.writeEntireFile(newFileName, "");
		SubNode newNode = createNodeForFileSystemItem(session, node, new File(newFileName), 0, null);
		return newNode;
	}

	/**
	 * User initiated function to create a new folder
	 */
	public SubNode createFolderUnderParent(MongoSession session, SubNode node) {
		String fullFileName = node.getStringProp(TYPES.FS_LINK);
		String newFileName = fullFileName + "/new-folder-" + DateUtil.getFileNameCompatDate();
		File newFolder = new File(newFileName);
		newFolder.mkdirs();
		SubNode newNode = createNodeForFileSystemItem(session, node, newFolder, 0, null);
		return newNode;
	}
}

