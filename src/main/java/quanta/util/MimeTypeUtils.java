package quanta.util;

import java.io.File;
import java.io.IOException;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import javax.activation.MimetypesFileTypeMap;

import org.apache.commons.io.FilenameUtils;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static quanta.util.Util.*;

public class MimeTypeUtils {
    private static final Logger log = LoggerFactory.getLogger(MimeTypeUtils.class);
    private static final Tika tika = new Tika();

    private static Map<String, String> mimeMap;
    static {
        mimeMap = new HashMap<>();
        // todo-1: why this tiny list here? If doing this why not many many more?
        mimeMap.put("mp4", "video/mp4");
        mimeMap.put("mp3", "audio/mp3");
        mimeMap.put("flv", "video/flv");
        mimeMap.put("webm", "video/webm");
        mimeMap.put("opus", "audio/webm");
        mimeMap.put("doc", "application/msword");
        mimeMap.put("md", "text/markdown");
    }

    public static String getMimeType(String extension) {
        if (!extension.isEmpty() && mimeMap.containsKey(extension)) {
            return mimeMap.get(extension);
        } else {
            String fileName = "file." + extension;
            String ret = MimetypesFileTypeMap.getDefaultFileTypeMap().getContentType(fileName);

            // If that getContentType didn't find anything specific, try again.
            if ("application/octet-stream".equals(ret)) {
                /*
                 * todo-1: we have some direct calls to guessContentTypeFromName, that should perhaps all be calling
                 * this method (getMimeType) instead.
                 */
                ret = URLConnection.guessContentTypeFromName(fileName);
            }
            return ret;
        }
    }

    // https://odoepner.wordpress.com/2013/07/29/transparently-improve-java-7-mime-type-recognition-with-apache-tika/
    public static String probeContentType(Path file) throws IOException {
        String mimeType = Files.probeContentType(file);
        if (no(mimeType)) {
            mimeType = tika.detect(file.toFile());

            if (no(mimeType)) {
                mimeType = getMimeType(FilenameUtils.getExtension(String.valueOf(file.getFileName())));
            }
        }

        // log.debug("ProbeMime: " + file.toString() + " = " + mimeType);
        return mimeType;
    }

    public static String getMimeType(File file) {
        String ret = null;

        try {
            String ext = FilenameUtils.getExtension(file.getCanonicalPath());
            if (ext.equalsIgnoreCase("md")) {
                ret = "text/plain";
            } else {
                ret = MimetypesFileTypeMap.getDefaultFileTypeMap().getContentType(file);
            }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
        return ret;
    }
}