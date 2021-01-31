package org.subnode.util;

import java.io.File;
import java.util.ArrayList;
import java.util.Observable;
import java.util.Observer;

/**
 * Encapsulates the process of recursively walking a folder to process each file contained under it.
 * 
 * todo-1: Observer class is deprecated by Java.
 *
 */
public class FileLister implements Observer {
	private FileWalker fw;
	// private int errors = 0;
	private boolean recursive = true;
	private boolean includeFolders = false;
	private boolean includeFiles = true;
	private StringPatternMatcher matcher = null;
	private ArrayList<String> fileList;
	private IFileListingCallback callback;
	private boolean cacheNames = true;

	public FileLister() {
	}

	public FileLister(boolean recursive, boolean includeFiles, boolean includeFolders) {
		this.recursive = recursive;
		this.includeFolders = includeFolders;
		this.includeFiles = includeFiles;
	}

	public void abort() {
		if (fw != null) {
			fw.abort();
		}
	}

	public void setCacheNames(boolean cacheNames) {
		this.cacheNames = cacheNames;
	}

	public void setCallback(IFileListingCallback callback) {
		this.callback = callback;
	}

	public void list(String dir) {
		fileList = new ArrayList<String>();

		fw = new FileWalker();
		fw.addObserver(this);
		fw.walk(new File(dir), true, recursive);
	}

	public void setRecursive(boolean recursive) {
		this.recursive = recursive;
	}

	public void setIncludeFolders(boolean includeFolders) {
		this.includeFolders = includeFolders;
	}

	public void setIncludeFiles(boolean includeFiles) {
		this.includeFiles = includeFiles;
	}

	public void setExtensionsFilter(String patterns) {
		if (matcher == null) {
			matcher = new StringPatternMatcher();
		}

		matcher.addListOfPatterns(patterns);
	}

	// This method is called for each file that the file walker discovers.
	@Override
	public void update(Observable o, Object arg) {
		try {
			File f = (File) arg;
			String fileName = f.getCanonicalPath();

			// TODO: I don't guess I ever needed filtering (checkFilter) on folders??
			if (includeFolders && f.isDirectory()) {
				if (cacheNames) fileList.add(fileName);
				if (callback != null) {
					callback.update(f);
				}
			}

			if (includeFiles && f.isFile()) {
				if (checkFilter(fileName)) {
					if (cacheNames) fileList.add(fileName);
					if (callback != null) {
						callback.update(f);
					}
				}
			}
		}
		catch (Exception e) {
			// errors++;
			e.printStackTrace();
		}
	}

	public boolean checkFilter(String fileName) {
		if (matcher == null) return (true);

		File f = new File(fileName);
		boolean match = matcher.matches(f.getName());
		return match;
	}

	public int getFileCount() {
		if (fileList == null) return (0);
		return fileList.size();
	}

	public String getFileAt(int i) {
		if (fileList == null) return (null);
		return fileList.get(i);
	}
}
