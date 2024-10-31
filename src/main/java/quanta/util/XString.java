package quanta.util;

import java.io.File;
import java.io.InputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.Resource;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectWriter;
import quanta.exception.base.RuntimeEx;

/**
 * General string utilities.
 *
 * todo-3: Look for ways to use this: Java 11 adds a few new methods to the String class: isBlank,
 * lines, strip, stripLeading, stripTrailing, and repeat.
 */
public class XString {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(XString.class);

    private static ObjectWriter jsonPrettyWriter = Util.mapper.writerWithDefaultPrettyPrinter();
    private static ObjectWriter jsonCompactWriter = Util.mapper.writer();

    public static String prettyPrint(Object obj) {
        if (obj == null)
            return "null";
        if (obj instanceof String o) {
            return o;
        }
        try {
            return jsonPrettyWriter.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    public static String compactPrint(Object obj) {
        if (obj == null)
            return "null";
        if (obj instanceof String o) {
            return o;
        }
        try {
            return jsonCompactWriter.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    public static boolean isValidMarkdownHeading(String heading) {
        // Regex to match invalid characters
        String invalidCharactersRegex = "[^a-zA-Z0-9\\-_ ]";

        // Check if the heading contains any invalid characters
        return !heading.matches(".*" + invalidCharactersRegex + ".*");
    }

    public static String getStringFromStream(InputStream inputStream) {
        try {
            StringWriter writer = new StringWriter();
            String encoding = StandardCharsets.UTF_8.name();
            IOUtils.copy(inputStream, writer, encoding);
            return writer.toString();
        } catch (Exception e) {
            throw new RuntimeEx("getStringFromStream failed.", e);
        }
    }

    public static String lastNChars(String val, int chars) {
        if (val.length() > chars) {
            return val.substring(val.length() - chars);
        } else {
            return val;
        }
    }

    public static String repeatingTrimFromFront(String val, String prefix) {
        if (val == null)
            return null;
        int loopSafe = 0;
        val = val.trim();

        while (++loopSafe < 1000) {
            int len = val.length();
            val = val.trim();
            val = stripIfStartsWith(val, prefix);
            // if string remained same length we're done
            if (len == val.length()) {
                break;
            }
        }
        return val;
    }

    public static String repeatingTrimFromEnd(String val, String ending) {
        if (val == null)
            return null;
        int loopSafe = 0;
        val = val.trim();

        while (++loopSafe < 1000) {
            int len = val.length();
            val = val.trim();
            val = stripIfEndsWith(val, ending);
            // if string remained same length we're done
            if (len == val.length()) {
                break;
            }
        }
        return val;
    }

    public static List<String> tokenizeWithDelims(String val, String delimiter) {
        if (val == null)
            return null;
        List<String> list = null;
        StringTokenizer t = new StringTokenizer(val, delimiter, true);

        while (t.hasMoreTokens()) {
            if (list == null) {
                list = new LinkedList<>();
            }
            list.add(t.nextToken());
        }
        return list;
    }

    public static List<String> tokenize(String val, String delimiter, boolean trim) {
        if (val == null)
            return null;
        List<String> list = null;
        StringTokenizer t = new StringTokenizer(val, delimiter, false);

        while (t.hasMoreTokens()) {
            if (list == null) {
                list = new LinkedList<>();
            }
            list.add(trim ? t.nextToken().trim() : t.nextToken());
        }
        return list;
    }

    /**
     * Returns a list of tokens from the input string 'val' that are separated by the input delimiter
     * 'delimiter'. The tokens are trimmed of whitespace if the input 'trim' is true.
     */
    public static HashSet<String> tokenizeToSet(String val, String delimiter, boolean trim) {
        HashSet<String> list = null;
        StringTokenizer t = new StringTokenizer(val, delimiter, false);

        while (t.hasMoreTokens()) {
            if (list == null) {
                list = new HashSet<>();
            }
            list.add(trim ? t.nextToken().trim() : t.nextToken());
        }
        return list;
    }

    /*
     * Returns the heading level assuming 'val' contains text that starts with something like
     * "# My Heading" (reurns 1), or "## My Heading" (returns 2), by returning the number of hash marks
     * in the heading. Anything not a heading will return 0
     */
    public static int getHeadingLevel(String val) {
        if (!val.startsWith("#")) {
            return 0;
        }
        int len = val.length();
        int idx = 0;
        char c = 0;
        /*
         * we have 'len-2' here because in an example like "## a" this is a heading "a", and we don't need
         * to try to iterate into the final " a" part so we know we should always iterate only out to two
         * chars from the end of the string
         */
        while (idx < len - 2 && (c = val.charAt(idx)) == '#') {
            idx++;
            // if we've counted the max number of headings levels, just point 'c' to the next char
            // bail out of looping
            if (idx >= 6) {
                c = val.charAt(idx);
                break;
            }
        }
        if (c != ' ')
            return 0;
        return idx;
    }

    public static boolean isMarkdownHeading(String val) {
        if (val == null)
            return false;
        int level = getHeadingLevel(val);
        return level >= 1 && level <= 6;
    }

    public static String trimToMaxLen(String val, int maxLen) {
        if (val == null)
            return null;
        if (val.length() <= maxLen)
            return val;
        return val.substring(0, maxLen - 1);
    }

    public static String getResourceAsString(ApplicationContext context, String resourceName) {
        InputStream is = null;
        String ret = null;
        resourceName = "classpath:" + resourceName;
        try {
            Resource resource = context.getResource(resourceName);
            is = resource.getInputStream();
            ret = IOUtils.toString(is, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            throw new RuntimeEx("Unable to read resource: " + resourceName, e);
        } finally {
            StreamUtil.close(is);
        }
        return ret;
    }

    /* Truncates after delimiter including truncating the delimiter */
    public static String truncAfterFirst(String text, String delim) {
        if (text == null)
            return null;
        int idx = text.indexOf(delim);
        if (idx != -1) {
            text = text.substring(0, idx);
        }
        return text;
    }

    public static String stripIfEndsWith(String val, String suffix) {
        if (val.endsWith(suffix)) {
            val = val.substring(0, val.length() - suffix.length());
        }
        return val;
    }

    public static String stripIfStartsWith(String val, String prefix) {
        if (val == null)
            return val;
        if (val.startsWith(prefix)) {
            val = val.substring(prefix.length());
        }
        return val;
    }

    public static String removeLastChar(String str) {
        return str.substring(0, str.length() - 1);
    }

    /**
     * Truncates after last delimiter including truncating the delimiter
     */
    public static String truncAfterLast(String text, String delim) {
        if (text == null)
            return null;
        int idx = text.lastIndexOf(delim);
        if (idx != -1) {
            text = text.substring(0, idx);
        }
        return text;
    }

    /**
     * Removes specified characters from a given string.
     *
     * This method takes two strings, 'str' and 'removes', and returns a modified copy of 'str' where
     * any characters that exist in the 'removes' string have been removed.
     */
    public static String removeChars(String str, String removes) {
        StringBuilder result = new StringBuilder();

        for (int i = 0; i < str.length(); i++) {
            char currentChar = str.charAt(i);

            // Check if the current character is not in the 'removes' string
            if (removes.indexOf(currentChar) == -1) {
                result.append(currentChar);
            }
        }
        return result.toString();
    }

    /**
     * Returns a copy of the input string 'str' with characters from the 'removes' string removed from
     * the beginning of 'str'.
     */
    public static String removeCharsFromBeginning(String str, String removes) {
        if (str == null || removes == null || str.isEmpty() || removes.isEmpty()) {
            return str;
        }

        Set<Character> removesSet = new HashSet<>();
        for (char c : removes.toCharArray()) {
            removesSet.add(c);
        }

        StringBuilder result = new StringBuilder(str);
        while (!result.toString().isEmpty() && removesSet.contains(result.charAt(0))) {
            result.deleteCharAt(0);
        }
        return result.toString();
    }

    /**
     * Returns a copy of the input string 'str' with characters from the 'removes' string removed from
     * the end of 'str'.
     */
    public static String removeCharsFromEnd(String str, String removes) {
        if (str == null || removes == null || str.isEmpty() || removes.isEmpty()) {
            return str;
        }

        Set<Character> removesSet = new HashSet<>();
        for (char c : removes.toCharArray()) {
            removesSet.add(c);
        }

        StringBuilder result = new StringBuilder(str);
        int length = result.length();
        while (length > 0 && removesSet.contains(result.charAt(length - 1))) {
            result.deleteCharAt(length - 1);
            length = result.length();
        }
        return result.toString();
    }

    public static String parseAfterLast(String text, String delim) {
        if (text == null)
            return null;
        int idx = text.lastIndexOf(delim);
        if (idx != -1) {
            text = text.substring(idx + delim.length());
        }
        return text;
    }

    /*
     * Ensures string containing val which is number is prepended with leading zeroes to make the string
     * 'count' chars long. Using simplest inefficient algorithm for now. Can be done faster with one
     * concat
     */
    public static String addLeadingZeroes(String val, int count) {
        while (val.length() < count) {
            val = "0" + val;
        }
        return val;
    }

    /**
     * input: abc--file.txt, -- output: file.txt
     */
    public String truncBefore(String fileName, String delims) {
        if (fileName == null)
            return null;
        String ret = null;
        int idx = fileName.indexOf(delims);
        if (idx != -1) {
            ret = fileName.substring(idx + delims.length());
        } else {
            ret = fileName;
        }
        return ret;
    }

    /**
     * input: abc--file.txt, . output: abc--file
     */
    public String truncAfter(String fileName, String delims) {
        if (fileName == null)
            return null;
        String ret = null;
        int idx = fileName.lastIndexOf(delims);
        if (idx != -1) {
            ret = fileName.substring(0, idx);
        } else {
            ret = fileName;
        }
        return ret;
    }

    /**
     * input: /home/clay/path/file.txt output: /home/clay/path
     */
    public String getPathPart(String fileName) {
        if (fileName == null)
            return null;
        String pathPart = null;
        int idx = fileName.lastIndexOf(File.separatorChar);
        if (idx != -1) {
            pathPart = fileName.substring(0, idx);
        } else {
            pathPart = fileName;
        }
        return pathPart;
    }

    public static boolean containsNonEnglish(String s) {
        if (s == null || s.length() == 0)
            return false;

        for (int i = 0; i < s.length(); i++) {
            if ((int) s.charAt(i) >= 128)
                return true;
        }
        return false;
    }

    public static boolean containsChinese(String s) {
        // This is specifically for Chinese
        // return s.codePoints().anyMatch(codepoint -> Character.UnicodeScript.of(codepoint) ==
        // Character.UnicodeScript.HAN);
        // This is more general.
        return s.codePoints().anyMatch(codepoint -> Character.isIdeographic(codepoint));
    }

    public static boolean containsRussian(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.UnicodeBlock.of(s.charAt(i)).equals(Character.UnicodeBlock.CYRILLIC)) {
                return true;
            }
        }
        return false;
    }

    public static String extractFirstJsonCodeBlock(String markdown) {
        if (markdown == null) {
            return null;
        }
        if (!markdown.contains("```json")) {
            return markdown;
        }

        // Define the pattern for a JSON code block
        // This pattern assumes the JSON code block starts with ```json and ends with ```
        Pattern pattern = Pattern.compile("```json\\s*?(.*?)```", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(markdown);

        if (matcher.find()) {
            // Return the content of the first matched group, which is the code block without the backticks
            return matcher.group(1).trim();
        } else {
            // If no JSON code block is found, return null or an empty string
            return null;
        }
    }

    // Divider is always either "and" or "or".
    public static List<String> extractQuotedStrings(String text, String divider) {
        List<String> quotedStrings = new ArrayList<>();
        Pattern pattern = Pattern.compile("\"([^\"]*)\"\\s*(?i:" + divider + ")\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            quotedStrings.add(matcher.group(1));
            quotedStrings.add(matcher.group(2));
        }
        return quotedStrings;
    }

    public static List<String> extractQuotedStrings(String text) {
        List<String> quotedStrings = new ArrayList<>();
        Pattern pattern = Pattern.compile("\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            quotedStrings.add(matcher.group(1));
        }
        return quotedStrings;
    }
}
