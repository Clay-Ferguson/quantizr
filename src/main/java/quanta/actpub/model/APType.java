package quanta.actpub.model;

/**
 * ActivityPub types
 */
public class APType {
    public static final String Create = "Create";
    public static final String Note = "Note";

    // Note: Pleroma sends these when you DM someone.
    public static final String ChatMessage = "ChatMessage";
    public static final String DID = "DID";
    
    public static final String Tombstone = "Tombstone";
    public static final String Follow = "Follow";
    public static final String Undo = "Undo";
    public static final String Delete = "Delete";
    public static final String Mention = "Mention";
    public static final String Document = "Document";
    public static final String Person = "Person";
    public static final String Image = "Image";
    public static final String Accept = "Accept";
    public static final String OrderedCollection = "OrderedCollection";
    public static final String OrderedCollectionPage = "OrderedCollectionPage";
}
