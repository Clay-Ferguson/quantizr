package org.subnode.util;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.util.HashSet;
import java.util.Set;

/**
 * Tools related to file management. Creating, deleting files, etc.
 *
 */
public class FileTools {
	private static final Logger log = LoggerFactory.getLogger(FileTools.class);

	public static boolean fileExists(String fileName) {
		if (fileName == null || fileName.equals(""))
			return false;

		return new File(fileName).isFile();
	}

	public static boolean dirExists(String fileName) {
		if (fileName == null || fileName.equals(""))
			return false;

		return new File(fileName).isDirectory();
	}

	public static boolean deleteFile(String fileName) {
		File f = new File(fileName);
		boolean exists = f.exists();
		if (!exists)
			return true;
		return f.delete();
	}

	public static boolean createDirectory(String dir) {
		File file = new File(dir);
		if (file.isDirectory())
			return true;
		boolean success = file.mkdirs();
		log.debug("Created folder: " + dir + ". success=" + success);
		return success;
	}

	public static void makeFileRunnable(String fileName) throws Exception {
		Set<PosixFilePermission> perms = new HashSet<PosixFilePermission>();
		perms.add(PosixFilePermission.OWNER_READ);
		perms.add(PosixFilePermission.OWNER_WRITE);
		perms.add(PosixFilePermission.OWNER_EXECUTE);
		perms.add(PosixFilePermission.GROUP_READ);
		perms.add(PosixFilePermission.GROUP_WRITE);
		perms.add(PosixFilePermission.GROUP_EXECUTE);
		perms.add(PosixFilePermission.OTHERS_READ);
		perms.add(PosixFilePermission.OTHERS_WRITE);
		perms.add(PosixFilePermission.OTHERS_EXECUTE);
		Files.setPosixFilePermissions(Paths.get(fileName), perms);
	}

	public static void writeEntireFile(String fileName, String content) {
		try {
			BufferedWriter out = new BufferedWriter(new FileWriter(fileName));
			try {
				out.write(content);
				out.flush();
			} finally {
				StreamUtil.close(out);
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public static String ensureValidFileNameChars(String text) {
		if (text == null)
			return null;

		int length = text.length();
		StringBuilder ret = new StringBuilder();
		char c;
		boolean lastWasDash = false;

		for (int i = 0; i < length; i++) {
			c = text.charAt(i);

			if (Character.isLetter(c) || Character.isDigit(c) || c == '.' || c == '-' || c == '_') {
				ret.append(c);
				lastWasDash = false;
			} else {
				if (!lastWasDash) {
					ret.append('-');
				}
				lastWasDash = true;
			}
		}

		return ret.toString();
	}
}
