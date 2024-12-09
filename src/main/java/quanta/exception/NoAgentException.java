package quanta.exception;

// Exception class where we want the message to be displayed to the user
public class NoAgentException extends MessageException {

    public NoAgentException() {
        super("No AI service found from parent nodes. Fix this by selecting a higher level node and using `Menu -> AI -> Configure Agent`");
    }
}
