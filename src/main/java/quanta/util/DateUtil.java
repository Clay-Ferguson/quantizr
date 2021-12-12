package quanta.util;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.TimeZone;
import org.apache.commons.lang3.StringUtils;
import quanta.exception.base.RuntimeEx;
import static quanta.util.Util.*;

/**
 * Date-related functions
 */
public class DateUtil {
	public static final int SECOND_MILLIS = 1000;
	public static final int MINUTE_MILLIS = 60 * SECOND_MILLIS;
	public static final int HOUR_MILLIS = 60 * MINUTE_MILLIS;

	/** Used to format date values */
	// public static final String ECMA_DATE_FORMAT = "EEE MMM dd yyyy HH:mm:ss
	// 'GMT'Z";
	public static final String DATE_FORMAT_WITH_TIMEZONE = "yyyy/MM/dd hh:mm:ss a z";
	public static final String DATE_FORMAT_NO_TIMEZONE = "yyyy/MM/dd hh:mm:ss a";
	public static final String DATE_FORMAT_NO_TIME = "yyyy/MM/dd";
	public static final String DATE_FORMAT_FILENAME_COMPAT = "yyMMddhhmmss";
	public final static String DATE_FORMAT = "MM/dd/yyyy HH:mm:ss";

	/** Used to format date values */
	public static final Locale DATE_FORMAT_LOCALE = Locale.US;
	private static final HashMap<String, String> zoneMap = new HashMap<>();

	/*
	 * Date APIs have deprecated the use of short abbreviations for timezones, but we preferr to still
	 * have them shown for at least United States timezones, so we have to implement our own way of
	 * detecting the proper one and also consider proper Daylight Savings Time value, which is of course
	 * coming from the browser.
	 */
	static {
		zoneMap.put("-4S", "AST"); // ATLANTIC STANDARD TIME UTC - 4
		zoneMap.put("-5S", "EST"); // EASTERN STANDARD TIME UTC - 5
		zoneMap.put("-4D", "EDT"); // EASTERN DAYLIGHT TIME UTC - 4
		zoneMap.put("-6S", "CST"); // CENTRAL STANDARD TIME UTC - 6
		zoneMap.put("-5D", "CDT"); // CENTRAL DAYLIGHT TIME UTC - 5
		zoneMap.put("-7S", "MST"); // MOUNTAIN STANDARD TIME UTC - 7
		zoneMap.put("-6D", "MDT"); // MOUNTAIN DAYLIGHT TIME UTC - 6
		zoneMap.put("-8S", "PST"); // PACIFIC STANDARD TIME UTC - 8
		zoneMap.put("-7D", "PDT"); // PACIFIC DAYLIGHT TIME UTC - 7
	}

	/* Note: this object is Session-specific to the timezone will be per user */
	public static SimpleDateFormat getDateFormat() {
		return new SimpleDateFormat(DATE_FORMAT_NO_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
	}

	public static SimpleDateFormat getDateFormatNoTime() {
		return new SimpleDateFormat(DATE_FORMAT_NO_TIME, DateUtil.DATE_FORMAT_LOCALE);
	}

	public static SimpleDateFormat getDateFormatFileNameCompat() {
		return new SimpleDateFormat(DATE_FORMAT_FILENAME_COMPAT, DateUtil.DATE_FORMAT_LOCALE);
	}

	/* Need to consider these. Will properly display as GMT-NNN */
	// AKST ALASKA TIME UTC - 9
	// AKDT ALASKA DAYLIGHT TIME UTC - 8
	// HST HAWAII STANDARD TIME UTC - 10
	// HAST HAWAII-ALEUTIAN STANDARD TIME UTC - 10
	// HADT HAWAII-ALEUTIAN DAYLIGHT TIME UTC - 9
	// SST SAMOA STANDARD TIME UTC - 11
	// SDT SAMOA DAYLIGHT TIME UTC - 10
	// CHST CHAMORRO STANDARD TIME UTC +10

	public static String getUSTimezone(int hours, boolean dst) {
		return zoneMap.get(String.valueOf(hours) + (dst ? "D" : "S"));
	}

	public static String shortFormatDate(long time) {
		SimpleDateFormat format = new SimpleDateFormat(DATE_FORMAT_NO_TIME);
		return format.format(time);
	}

	public static String standardFormatDate(long time) {
		SimpleDateFormat format = new SimpleDateFormat(DATE_FORMAT_NO_TIMEZONE);
		return format.format(time);
	}

	public static String getFormattedDate(long time) {
		SimpleDateFormat format = new SimpleDateFormat(DATE_FORMAT);
		return format.format(time);
	}

	public static String getFileNameCompatDate() {
		return getDateFormatFileNameCompat().format(new Date());
	}

	/* This is not the most elegant solution but appears to work */
	public static String getTimezoneFromOffset(int offsetMinutes) {

		int hours = offsetMinutes / 60;
		int mins = offsetMinutes - hours * 60;
		String minStr = String.valueOf(mins);
		if (minStr.length() < 2) {
			minStr = "0" + minStr;
		}

		// //////////////////
		// String[] timeZones = TimeZone.getAvailableIDs();
		// for (String timeZone : timeZones) {
		// TimeZone tz = TimeZone.getTimeZone(timeZone);
		//
		// // long hours = TimeUnit.MILLISECONDS.toHours(tz.getRawOffset());
		// // long minutes = TimeUnit.MILLISECONDS.toMinutes(tz.getRawOffset())
		// // - TimeUnit.HOURS.toMinutes(hours);
		// //
		// // String timeZoneString = String.format("( GMT %d:%02d ) %s(%s)",
		// hours,
		// // minutes, tz.getDisplayName(), timeZone);
		// // tzList.add(timeZoneString);
		// int h = tz.getRawOffset() / (1000 * 60 * 60);
		// int m = (tz.getRawOffset() - h * 1000 * 60 * 60)/(1000*60);
		// System.out.println("tz: " + h + ":" + m + " name: " +
		// tz.getDisplayName());
		// }
		// // //////////////////
		//
		String gmtZoneStr = "GMT-" + hours + ":" + minStr;
		//
		// TimeZone z = TimeZone.getTimeZone(gmtZoneStr);
		// String zoneString = z.getDisplayName();
		// log.debug("ZoneString: " + zoneString);

		return gmtZoneStr;
	}

	public static Date parse(String time) {
		try {
			time = time.replace("-", "/");
			return getDateFormat().parse(time);
		} catch (ParseException e) {
			/* if date parse fails, try without the time */
			if (time.length() > 10) {
				time = time.substring(0, 10);
				try {
					return getDateFormatNoTime().parse(time);
				} catch (ParseException e1) {
					throw new RuntimeEx(e);
				}
			}
			throw new RuntimeEx(e);
		}
	}

	/*
	 * Formats this duration into a string that describes the time about the way a human would say it.
	 * For example if it was a number of days ago you don't include minutes and seconds etc.
	 */
	public static String formatDurationMillis(long different) {
		StringBuilder sb = new StringBuilder();
		long secondsInMilli = 1000;
		long minutesInMilli = secondsInMilli * 60;
		long hoursInMilli = minutesInMilli * 60;
		long daysInMilli = hoursInMilli * 24;

		long days = different / daysInMilli;
		different = different % daysInMilli;

		long hours = different / hoursInMilli;
		different = different % hoursInMilli;

		long minutes = different / minutesInMilli;
		different = different % minutesInMilli;

		long seconds = different / secondsInMilli;

		if (days > 0) {
			sb.append(String.valueOf(days));
			sb.append("d");
		}

		if (hours > 0) {
			if (sb.length() > 0)
				sb.append(" ");
			sb.append(String.valueOf(hours));
			sb.append("h");
		}

		if (days == 0 && minutes > 0) {
			if (sb.length() > 0)
				sb.append(" ");
			sb.append(String.valueOf(minutes));
			sb.append("m");
		}

		if (days == 0 && hours == 0 && minutes < 3 && seconds > 0) {
			if (sb.length() > 0)
				sb.append(" ");
			sb.append(String.valueOf(seconds));
			sb.append("s");
		}

		return sb.toString();
	}

	public static String isoStringFromDate(Date date) {
		// todo-1: is timezone ok here?
		return date.toInstant().atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_INSTANT);
	}

	// Smitherene ActivityPub code uses this:
	// SimpleDateFormat dateFormat=new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
	// dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
	// String date=dateFormat.format(new Date());

	public static String getFormattedDateTime() {
		return ZonedDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
		// supposedly this also works:
		// thisMoment = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mmX")
		// .withZone(ZoneOffset.UTC)
		// .format(Instant.now());
	}

	// This is from a trustworthy-looking StackOverflow article, but untested by me.
	public static Date parseISOTime(String s) {
		OffsetDateTime odt = OffsetDateTime.parse(s);
		return Date.from(odt.toInstant());
	}

	public static long getMillisFromDuration(String durationStr) {
		if (StringUtils.isEmpty(durationStr))
			return 0;

		int colonIdx = durationStr.indexOf(":");
		if (colonIdx == -1) {
			// if no colon, assume minutes
			return Integer.parseInt(durationStr) * 60 * 1000;
		} else {
			String hrs = durationStr.substring(0, colonIdx);
			String mins = durationStr.substring(colonIdx + 1);
			return (Integer.parseInt(hrs) * 60 + Integer.parseInt(mins)) * 60 * 1000;
		}
	}

	public static String formatTimeForUserTimezone(Date date, String timezone, String timeZoneAbbrev) {
		if (no(date))
			return null;

		/* If we have a short timezone abbreviation display timezone with it */
		if (ok(timeZoneAbbrev)) {
			SimpleDateFormat dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_NO_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
			if (ok(timezone)) {
				dateFormat.setTimeZone(TimeZone.getTimeZone(timezone));
			}
			return dateFormat.format(date) + " " + timeZoneAbbrev;
		}
		/* else display timezone in standard GMT format */
		else {
			SimpleDateFormat dateFormat = new SimpleDateFormat(DateUtil.DATE_FORMAT_WITH_TIMEZONE, DateUtil.DATE_FORMAT_LOCALE);
			if (ok(timezone)) {
				dateFormat.setTimeZone(TimeZone.getTimeZone(timezone));
			}
			return dateFormat.format(date);
		}
	}
}
