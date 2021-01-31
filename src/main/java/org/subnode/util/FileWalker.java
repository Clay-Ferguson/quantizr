package org.subnode.util;

import java.io.File;
import java.util.Observable;

/**
 * 
 * Walks through the directory named dir in the call to walk method and notifies the observer of
 * each file encountered.
 * 
 * todo-1: Observable class is deprecated.
 */
public class FileWalker extends Observable {
	private int depth = 0;
	private boolean abort = false;

	public void walk(File dir, boolean includeFolders, boolean recurseFolders) {
		if (abort) return;

		try {
			depth++;

			if (dir.isDirectory()) {
				/*
				 * processing sub-directories first before calling notifyObservers below is what
				 * makes this a 'depth first' directory scan. This also means, by the way, that if
				 * the caller is enumerating a list of directories, then the sequence of directories
				 * returned can be deleted 'in the order they were enumerated' without any
				 * possibility of attempting to delete any directories that have directories under
				 * them (which would be a problem).
				 */
				String[] fileNames = dir.list();
				if (fileNames != null) {
					for (int i = 0; i < fileNames.length && !abort; i++) {
						if (recurseFolders || depth == 1) {
							walk(new File(dir, fileNames[i]), includeFolders, recurseFolders);
						}
					}
				}

				if (includeFolders) {
					setChanged();
					notifyObservers(dir);
				}
			}
			else {
				setChanged();
				notifyObservers(dir);
			}
		}
		catch (Exception e) {
			e.printStackTrace();
		}
		finally {
			depth--;
		}
	}

	public void abort() {
		abort = true;
	}
}
