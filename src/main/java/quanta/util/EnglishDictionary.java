package quanta.util;

import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

@Component 
public class EnglishDictionary extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(EnglishDictionary.class);
    private static final HashSet<String> stopWords = new HashSet<>();

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        super.handleContextRefresh(event);
        log.debug("ContextRefreshedEvent");
        loadWords("classpath:public/data/stop-words.txt", stopWords);
    }

    public void loadWords(String fileName, HashSet<String> words) {
        if (words.size() > 0)
            return;
        try {
            // Tip: Here's a shell script which starts with unsorted ununique 'words.txt' and processes it
            // into
            // unique sorted list in 'words-unique.txt'
            // sed 's/[[:blank:]]//g' words.txt > cleaned.txt
            // awk '!seen[$0]++' cleaned.txt | sort > words-unique.txt
            Resource resource = context.getResource(fileName);
            InputStream is = resource.getInputStream();
            BufferedReader in = new BufferedReader(new InputStreamReader(is));
            try {
                String line;

                while ((line = in.readLine()) != null) {
                    line = line.trim();
                    if (line.length() > 0) {
                        words.add(line.toLowerCase());
                    }
                }
            } finally {
                StreamUtil.close(in);
            }
            log.debug(fileName + " Word Count=" + words.size());
        } catch (Exception ex) {
            // log and ignore.
            log.error("Failed to load " + fileName, ex);
        }
    }

    public void writeStringArrayToFile(ArrayList<String> list, String fileName) {
        BufferedOutputStream os = null;
        try {
            byte[] nl = "\n".getBytes(StandardCharsets.UTF_8);
            os = new BufferedOutputStream(new FileOutputStream(fileName));

            for (String s : list) {
                os.write(s.getBytes(StandardCharsets.UTF_8));
                os.write(nl);
            }
        } catch (Exception e) {
            log.error("Error writing file", e);
        } finally {
            StreamUtil.close(os);
        }
    }

    public boolean isStopWord(String word) {
        if (word == null)
            return true;
        return stopWords.contains(word.toLowerCase());
    }
}
