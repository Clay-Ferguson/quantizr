package org.subnode.test;

import java.util.Date;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.subnode.util.DateUtil;

@Component("UtilsTest")
public class UtilsTest implements TestIntf {
	private static final Logger log = LoggerFactory.getLogger(UtilsTest.class);

	@Override
	public void test() throws Exception {
		log.debug("*****************************************************************************************");
		log.debug("UtilsTest Running!");

		Date d1 = DateUtil.parseISOTime("2011-12-03T10:15:30Z");
		log.debug("parsed d1: " + d1);
		Date d2 = DateUtil.parseISOTime("2021-05-25T15:43:28+00:00");
		log.debug("parsed d2: " + d2);
	}
}