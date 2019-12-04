package org.subnode.util;

import java.io.File;
import java.io.FileFilter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.comparator.NameFileComparator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class FileUtils {
	private static final Logger log = LoggerFactory.getLogger(FileUtils.class);

	/*
	 * Creates the set of file extensions that the Quantizr app will allow user to
	 * edit
	 */
	private static HashSet<String> editableExtensions = new HashSet<String>();
	static {
		editableExtensions.add("md");
		editableExtensions.add("txt");
		editableExtensions.add("sh");
	}

	private static HashSet<String> imageExtensions = new HashSet<String>();
	static {
		imageExtensions.add("jpg");
		imageExtensions.add("png");
		imageExtensions.add("gif");
		imageExtensions.add("bmp");
	}

	public long getFileCreateTime(File file) {
		try {
			BasicFileAttributes attr = Files.readAttributes(file.toPath(), BasicFileAttributes.class);
			return attr.creationTime().toMillis();
			// System.out.println("lastAccessTime: " + attr.lastAccessTime());
		} catch (Exception e) {
			return -1;
		}
	}

	public boolean isEditableFile(String fileName) {
		String ext = FilenameUtils.getExtension(fileName);
		boolean ret = editableExtensions.contains(ext.toLowerCase());
		// log.debug("EDITABLE: " + fileName + " -> " + ret + " EXT: " +
		// ext.toLowerCase());
		return ret;
	}

	public boolean isImageFile(String fileName) {
		String ext = FilenameUtils.getExtension(fileName);
		boolean ret = imageExtensions.contains(ext.toLowerCase());
		// log.debug("EDITABLE: " + fileName + " -> " + ret + " EXT: " +
		// ext.toLowerCase());
		return ret;
	}

	/**
	 * input: /home/clay/path/file.txt output: file.txt
	 */
	public final String getShortFileName(String fileName) {
		if (fileName == null)
			return null;

		String shortName = null;
		int idx = fileName.lastIndexOf(File.separatorChar);
		if (idx != -1) {
			shortName = fileName.substring(idx + 1);
		} else {
			shortName = fileName;
		}
		// log.debug("Short name of [" + fileName + "] is [" + shortName + "]");
		return shortName;
	}

	/**
	 * input: /home/clay/path/file.txt output: txt
	 * 
	 * If no extension exists empty string is returned
	 */
	public final String getFileNameExtension(String fileName) {
		if (fileName == null)
			return null;

		String ext = null;
		int idx = fileName.lastIndexOf(".");
		if (idx != -1) {
			ext = fileName.substring(idx + 1);
		} else {
			ext = "";
		}
		log.debug("Ext of [" + fileName + "] is [" + ext + "]");
		return ext;
	}

	public static String readFile(File file) {
		try {
			return readFile(file.getCanonicalPath());
		} catch (Exception e) {
			throw new RuntimeException("unable to read fil.", e);
		}
	}

	public static String readFile(String path) {
		try {
			byte[] encoded = Files.readAllBytes(Paths.get(path));
			return new String(encoded, StandardCharsets.UTF_8);
		} catch (Exception e) {
			throw new RuntimeException("unable to read file: " + path, e);
		}
	}

	public File[] getSortedListOfFolders(String folder, Set<String> exclusions) {
		File directory = new File(folder);
		if (!directory.isDirectory()) {
			throw new RuntimeException("Folder doesn't exist: " + folder);
		}

		/* First read folders and sort them */
		File[] folders = directory.listFiles(new FileFilter() {
			@Override
			public boolean accept(File file) {
				if (exclusions != null && exclusions.contains(file.getAbsolutePath())) {
					return false;
				}
				return file.isDirectory() && !file.getName().startsWith(".");
			}
		});
		if (folders != null) {
			Arrays.sort(folders, NameFileComparator.NAME_COMPARATOR);
		}

		// log.debug("folderCount=" + (folders != null ? folders.length : 0));
		return folders;
	}

	public File[] getSortedListOfFiles(String folder, Set<String> exclusions) {
		File directory = new File(folder);
		if (!directory.isDirectory()) {
			throw new RuntimeException("Folder doesn't exist: " + folder);
		}
		/* Then read files and sort them */
		File[] files = directory.listFiles(new FileFilter() {
			@Override
			public boolean accept(File file) {
				if (exclusions != null && exclusions.contains(file.getAbsolutePath())) {
					return false;
				}
				return file.isFile() && (file.getName().equals(".meta-fs") || !file.getName().startsWith("."));
			}
		});
		if (files != null) {
			Arrays.sort(files, NameFileComparator.NAME_COMPARATOR);
		}
		// log.debug("fileCount=" + (files != null ? files.length : 0));
		return files;
	}

	public boolean fileOrFolderExists(String fileName) {
		if (fileName == null || fileName.trim().length() == 0)
			return false;
		return new File(fileName).exists();
	}
}
