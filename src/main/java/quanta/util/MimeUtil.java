package quanta.util;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.tika.Tika;
import org.springframework.stereotype.Component;
import jakarta.activation.MimetypesFileTypeMap;
import quanta.config.ServiceBase;

/**
 * Mime-Type (content type) utilities
 */
@Component 
public class MimeUtil extends ServiceBase {
    private static final Tika tika = new Tika();
    private static Map<String, String> mimeMap;

    static {
        mimeMap = new HashMap<>();
        mimeMap.put("mp4", "video/mp4");
        mimeMap.put("mp3", "audio/mp3");
        mimeMap.put("flv", "video/flv");
        mimeMap.put("webm", "video/webm");
        mimeMap.put("opus", "audio/webm");
        mimeMap.put("doc", "application/msword");
        mimeMap.put("md", "text/markdown");
    }

    public boolean isTextTypeFileName(String fileName) {
        if (!fileName.contains("."))
            return false;

        String ext = XString.parseAfterLast(fileName, ".");

        // todo-2: will be getting these from a properties file eventually
        if (ext.equalsIgnoreCase("txt") || //
                ext.equalsIgnoreCase("md") || //
                ext.equalsIgnoreCase("json")) {
            return true;
        }
        return false;
    }

    public boolean isHtmlTypeFileName(String fileName) {
        if (!fileName.contains("."))
            return false;

        String ext = XString.parseAfterLast(fileName, ".");

        // todo-2: will be getting these from a properties file eventually
        if (ext.equalsIgnoreCase("htm") || //
                ext.equalsIgnoreCase("html")) {
            return true;
        }
        return false;
    }

    public boolean isJsonFileType(String fileName) {
        if (!fileName.contains("."))
            return false;
        if (fileName.toLowerCase().endsWith(".json.txt"))
            return true;
        String ext = XString.parseAfterLast(fileName, ".");
        return ext.equalsIgnoreCase("json");
    }

    public static String getMimeType(String extension) {
        if (!extension.isEmpty() && mimeMap.containsKey(extension)) {
            return mimeMap.get(extension);
        } else {
            String fileName = "file." + extension;
            String ret = MimetypesFileTypeMap.getDefaultFileTypeMap().getContentType(fileName);
            // If that getContentType didn't find anything specific, try again.
            if ("application/octet-stream".equals(ret)) {
                ret = URLConnection.guessContentTypeFromName(fileName);
            }
            return ret;
        }
    }

    public static String probeContentType(Path file) throws IOException {
        String mimeType = Files.probeContentType(file);
        if (mimeType == null) {
            mimeType = tika.detect(file.toFile());
            if (mimeType == null) {
                mimeType = getMimeType(FilenameUtils.getExtension(String.valueOf(file.getFileName())));
            }
        }
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

    public static String getExtensionFromMimeType(String mime) {
        int index = mime.indexOf("/");
        if (index == -1) {
            return "";
        }
        return "." + mime.substring(index + 1);
    }

    public static String getMimeTypeFromUrl(String url) {
        String mimeType = null;
        // try to get mime from name first.
        mimeType = URLConnection.guessContentTypeFromName(url);
        // if didn't get mime from name, try reading the actual url
        if (StringUtils.isEmpty(mimeType)) {
            int timeout = 60; // seconds
            try {
                URL urlObj = new URI(url).toURL();
                URLConnection conn = urlObj.openConnection();
                conn.setConnectTimeout(timeout * 1000);
                conn.setReadTimeout(timeout * 1000);
                mimeType = conn.getContentType();
            } catch (Exception e) {
                // ignore
            }
        }
        return mimeType;
    }

    // Another way is this (according to baeldung site)
    // Path path = new File("product.png").toPath();
    // String mimeType = Files.probeContentType(path);
    public static String getMimeFromFileType(String fileName) {
        String mimeType = null;
        // mimeType can be passed as null if it's not yet determined
        if (mimeType == null) {
            mimeType = URLConnection.guessContentTypeFromName(fileName);
        }
        if (mimeType == null) {
            String ext = FilenameUtils.getExtension(fileName);
            mimeType = MimeUtil.getMimeType(ext);
        }
        // fallback to at lest some acceptable mime type
        if (mimeType == null) {
            mimeType = "application/octet-stream";
        }
        return mimeType;
    }
}
