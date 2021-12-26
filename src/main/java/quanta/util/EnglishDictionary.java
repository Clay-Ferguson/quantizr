package quanta.util;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.StringTokenizer;
import javax.annotation.PostConstruct;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.config.SpringContextUtil;

@Component
public class EnglishDictionary extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(EnglishDictionary.class);
	private static final HashSet<String> dictWords = new HashSet<>();
	private static final HashSet<String> stopWords = new HashSet<>();

	@PostConstruct
	public void postConstruct() {
		english = this;
	}

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		log.debug("ContextRefreshedEvent");
		initDictWords();
		initStopWords();
	}

	public void initStopWords() {
		if (stopWords.size() > 0)
			return;

		try {
			/*
			 * If you read in a new file here with new stop words in it which you may have just pasted in at the
			 * bottom or wherever then you can just uncomment the section (with the text
			 * '/tmp/stop-words-new.txt') below to write them into a new sorted file with dupliates removed
			 */
			Resource resource = SpringContextUtil.getApplicationContext().getResource("classpath:public/data/stop-words.txt");
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));
			try {
				String line;
				while (ok(line = in.readLine())) {
					StringTokenizer tokens = new StringTokenizer(line, " \n\r\t.,", false);
					while (tokens.hasMoreTokens()) {
						stopWords.add(tokens.nextToken().trim());
					}
				}
				// ---------------------------------------------------------------
				// DO NOT DELETE (See note above)
				// ArrayList<String> wordList = new ArrayList<String>(stopWords);
				// java.util.Collections.sort(wordList);
				// writeStringArrayToFile(wordList, "/tmp/stop-words-new.txt");
				// ---------------------------------------------------------------
			} finally {
				StreamUtil.close(in);
			}
			log.debug("stop word import successful: Word Count=" + stopWords.size());
		} catch (Exception ex) {
			// log and ignore.
			log.error("Failed initializing dictionary", ex);
		}
	}

	public void writeStringArrayToFile(ArrayList<String> list, String fileName) {
		BufferedOutputStream os = null;
		try {
			byte[] nl = "\n".getBytes();
			os = new BufferedOutputStream(new FileOutputStream(fileName));
			for (String s : list) {
				os.write(s.getBytes());
				os.write(nl);
			}
		} catch (Exception e) {
			log.error("Error writing file", e);
		} finally {
			StreamUtil.close(os);
		}
	}

	public boolean isStopWord(String word) {
		if (no(word))
			return true;
		return stopWords.contains(word.toLowerCase());
	}


	public void initDictWords() {
		if (dictWords.size() > 0)
			return;

		try {
			Resource resource =
					SpringContextUtil.getApplicationContext().getResource("classpath:public/data/english-dictionary.txt");
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));
			try {
				String line;
				while (ok(line = in.readLine())) {
					dictWords.add(line.trim().toLowerCase());
				}
			} finally {
				StreamUtil.close(in);
			}
			log.debug("dictionary import successful: Word Count=" + dictWords.size());
		} catch (Exception ex) {
			// log and ignore.
			log.error("Failed initializing dictionary", ex);
		}
		test();
	}

	/*
	 * Tokenizes text (like a paragraph of text) to determine if it appears to be English.
	 * 
	 * Unfortunately this will currently kick out computer code as non-english, but it I have some ideas
	 * for how fix that by detecting an unusual high number of free floating '{' or '=' or lines ending
	 * in semicolon for example to detect and allow code.
	 */
	public boolean isEnglish(String text) {
		if (dictWords.size() == 0)
			throw new RuntimeException("called isEnglish before dictionary was loaded.");
		if (no(text))
			return false;

		// log.debug("Checking english: " + text);
		int englishCount = 0;
		int unknownCount = 0;

		/*
		 * Counts all the 'words' in the text that consist purely of alphabet strings (letters) and returns
		 * true only of known English words outnumber unknown words, making the assumption that despite that
		 * some popular English slang won't be in the dictionary (i.e. Frens==Friends), we can still detect
		 * if text is not in English language at all using this statistical technique.
		 * 
		 * NOTE: Do not include '@' or '#' in the delimiters, because by leaving those out we have the
		 * effect of ignoring usernames and also hashtags which we don't want to check for English or not.
		 */
		StringTokenizer tokens = new StringTokenizer(text, " \n\r\t.,-;:\"'`!?()*", false);
		while (tokens.hasMoreTokens()) {
			String token = tokens.nextToken().trim();

			// only consider words that are all alpha characters
			if (!StringUtils.isAlpha(token) || token.length() < 5) {
				// log.debug(" ignoring: " + token);
				continue;
			}

			token = token.toLowerCase();
			if (dictWords.contains(token)) {
				englishCount++;
				// log.debug(" isEnglish: " + token);
			} else {
				unknownCount++;
				// log.debug(" notEnglish: " + token);
			}
		}

		if (englishCount == 0 && unknownCount == 0)
			return true;

		float percent = (float) englishCount / (englishCount + unknownCount);
		// log.debug("eng=" + englishCount + " nonEng=" + unknownCount + " %=" + percent);

		// if it's over 60% English, return true
		return percent > 0.60f;
	}

	public void test() {
		log.debug("English TEST1=" + isEnglish("ooga booga wooga tooga"));
	}
}
