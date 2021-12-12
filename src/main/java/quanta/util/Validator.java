package quanta.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import quanta.mongo.MongoAuth;

@Component
public class Validator {

	@Autowired
	private MongoAuth auth;

	/*
	 * UserName requirements, between 5 and 100 characters (inclusive) long, and only allowing digits,
	 * letters, underscore, dash, and space.
	 * 
	 * Note that part of our requirement is that it must also be a valid substring inside node path
	 * names, that are used or looking up things about this user.
	 */
	public String checkUserName(String userName) {
		if (!auth.isAllowedUserName(userName)) {
			return "Invalid or illegal user name.";
		}

		int len = userName.length();
		if (len < 3 || len > 100)
			throw ExUtil.wrapEx("Username must be between 3 and 100 characters long.");

		for (int i = 0; i < len; i++) {
			char c = userName.charAt(i);
			if (!(Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')) {
				return "Username can contain only letters, digits, dashes, underscores, and spaces. invalid[" + userName + "]";
			}
		}
		return null;
	}

	/* passwords are only checked for length of 5 thru 100 */
	public String checkPassword(String password) {
		int len = password.length();
		if (len < 5 || len > 40)
			return "Password must be between 5 and 40 characters long.";
		return null;
	}

	public String checkEmail(String email) {
		int len = email.length();
		if (len < 7 || len > 100)
			return "Invalid email address";
		return null;
	}
}
