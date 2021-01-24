package org.subnode.util;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashSet;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.subnode.config.SpringContextUtil;

@Component
public class EnglishDictionary {
	private static final Logger log = LoggerFactory.getLogger(EnglishDictionary.class);
	private static final HashSet<String> words = new HashSet<String>();

	public void init() {
		if (words.size() > 0)
			return;

		try {
			Resource resource = SpringContextUtil.getApplicationContext().getResource("classpath:english-dictionary.txt");
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));
			try {
				String line;
				while ((line = in.readLine()) != null) {
					words.add(line.trim().toLowerCase());
				}
			} finally {
				StreamUtil.close(in);
			}
			log.debug("dictionary import successful: Word Count=" + words.size());
		} catch (Exception ex) {
			// log and ignore.
			log.error("Failed initializing dictionary", ex);
		}
	}

	/*
	 * Tokenizes text (like a paragraph of text) to determine if it appears to be English.
	 * 
	 * Unfortunately this will currently kick out computer code as non-english, but it I have some ideas
	 * for how fix that by detecting an unusual high number of free floating '{' or '=' or lines ending
	 * in semicolon for example to detect and allow code.
	 */
	public boolean isEnglish(String text) {
		if (words.size() == 0)
			throw new RuntimeException("called isEnglish before dictionary was loaded.");
		if (text == null)
			return false;

		int englishCount = 0;
		int unknownCount = 0;

		/*
		 * NOTE: Do not include '@' or '#' in the delimiters, because by leaving it out we have the effect
		 * of ignoring usernames and also hashtags which we don't want to check for english or not.
		 */
		StringTokenizer tokens = new StringTokenizer(text, " \n\r\t.,-;:\"'`!?()*", false);
		while (tokens.hasMoreTokens()) {
			String token = tokens.nextToken().trim();

			// only consider words that are all alpha characters
			if (!StringUtils.isAlpha(token))
				continue;

			token = token.toLowerCase();
			if (words.contains(token)) {
				englishCount++;
			} else {
				unknownCount++;
			}
		}
		if (unknownCount == 0)
			return true;

		// if it's more english than not, consider it english.
		return englishCount > unknownCount;
	}
}
