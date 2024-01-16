**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

# About Quanta

General overview and terminology

# What is Quanta

Quanta is a web platform for creating, editing, and sharing hierarchical content, with features similar to Wikis, Content Management Systems, and Social Media platforms.

Create hierarchically organized content that's editable like a document, blog, or wiki, and structured like a tree, or a file system. You can navigate and explore the content by browsing this tree, posting nodes onto it, searching it, sharing branches of it, viewing timelines, etc.

Quanta is `re-brandable` so it can be run with your own custom logos and branding images and text. The `quanta.wiki` website itself is just a 'demo instance' to showcase the capabilities of the platform.

# Concepts and Terminology

To allow a fine-grained hierarchical approach to content organization, the platform `"quantizes"` each piece of information into `Tree Nodes` (thus the name `"Quanta"`). 

Node content can be as small as one sentence (like a tweet), or as large as you want, having multiple paragraphs of text. Each node can also have file attachments (images, videos, etc.) Depending on context, sometimes the word `Folder` is used and sometimes the word `Node` is used, but the important thing to know is that each Node (piece of content) can contain other Nodes, so in this way content nodes are similar to file system `Folders`, and are also Tree-like.

With these small chunks of content you can create nodes that are Social Media posts (free-standing content without any prior context); but you can also organize content into larger structures to compose a document, blog, or other long-form content, with different sections, chapters, headings, etc. containing the individual sentences and paragraphs of the document.

Since everyone is familiar with files and folders in the context of a computer operating system, the main thing to remember is that Quanta uses the terms tree, branch, or even subgraph to refer to what you already know as "Folders". 

So if you simply realize a folder structure on computers is a "Tree" then everything else about the Quanta terminology should be intuitive and obvious to you. The term "Node" just means "something on the tree".

All nodes can contain any number of subnodes (which is what makes Quanta a `tree`). This means Quanta is "browsable" like a file system, but instead of seeing file names and folder names (like a file-manager), you see the actual content text and images, displayed inline on the page.

Similar to how Twitter has `Tweets`, Facebook has `Posts`, Jupyter Notebooks has `cells`, etc., Quanta has a fundamental piece of content called a `Node`. These nodes make up hierarchies of content so, to repeat the above, they can represent Documents (a tree structure of paragraphs), Wikis, Social Media posts, blogs, or anything else. There's no distinction between those use cases. 

Each user owns one branch of the tree (their account root node, and whatever you've created under it).

The final important thing to realize about `Nodes` is that in general the way you reply to a piece of content is by creating a `subnode under the node you're replying to`. So this means when multiple people are creating content collaboratively it automatically becomes the logical equivalent of a "Social Media Thread", and in Quanta these threads are therefore hierarchical. However, unlike a `chat room` there's never any confusion about what any post is a reply to because the parent node is understood to be that.

# Sharing and Publishing

Each node automatically has its own unique URL, and can be shared with others or kept private. You can also (optionally) enter a name on any node to make it available by a more user-friendly URL, that uses the name you give it instead of the default numerical identifier (Record ID).

For example, below is an example URL for a node owned by user 'bob' that's named 'blog'. Simply by naming the node 'blog' (done in the Node Editor) and making the node 'public' this URL is automatically accessible by everyone, as a web page at the following URL:

* https://quanta.wiki/u/bob/blog

# A New Collaboration Model

The hierarchical structure is powerful for organizing data and documents, but is also what enables ad-hoc discussion threads to form under any node in the content. When collaborating on a document, for example, any piece of content can have arbitrarily large discussion threads branching off underneath it.

In many ways, this type of collaboration architecture (i.e. tree-based) is preferable to the old-school 'revision marks' used by conventional monolithic document editors (like Microsoft Office 365). 

Not only can multiple people suggest revisions to any given sentence, but there can be an entire team discussion happening under any sentence or paragraph in a document, without interrupting the flow of the document itself.

This method of collaboration also eliminates the need for sending emails back and forth when some specifics of a document need to be discussed. Document changes can be discussed right inside the document itself, right at the location of the proposed change!

To expand on this `hierarchical threading model` a bit more: A branch of the tree *is considered* a conversation thread (by definition), if it contains a chain of replies to nodes.

In other words, the way you `reply` to a post (or node) is by creating a subnode directly under it. The general understanding is simply that if you create a node under someone else's node, then you're saying something in reference to the parent node. 

So there's no need for a concept like "creating a new thread" (like the awkward way Discord and many other platforms have attempted to solve what is undeniably a need for hierarchical content), because everything in Quanta is always essentially a thread already, because everything is a branch of a tree.
 
The key point here: `All Conversation Threads are Trees`

You may have also used the "Quote in Reply" feature of Discord or other platforms where you're in a large chat room, wanting to reply to some specific post. Have you noticed how that's very awkward in a room with multiple simultaneous conversations happening at the same time? When everyone has to re-quote what they're replying to, the whole chat room becomes chaotic and cluttered. Also you have to constantly enter someone's name in every reply or else your message won't have proper context, and no one can tell who you're even replying to, without all this additional effort and duplication of text.

`Quanta elegantly solves *all* of this chaos`, simply by being a tree at the fundamental level: There's never any question about what a node is a `reply to` because that is always its `parent` node! 

The more conventional Timeline view is still always just one click away to display the Rev-Chron view of any tree branch whenever you *do* want a merged list of everything said by everyone (under some subgraph of the tree), all merged together into a single list.

If you're thinking it sounds awkward to have to expand any node to see what's under it, that's because you do need to know *how* to use `Timelines` and also the `Document View`.

The "Timeline" button (clock icon, at top of Folders Tab) can be used to instantly see the more 'standard' reverse-chronological view under that node (like how Twitter or Mastodon would display it).

Knowing how to seamlessly jump back and forth between the `Folders Tab` (a Tree View) and the `Timeline Tab` (a Rev-Chron View) is the key to being able to use the platform effectively and is a necessary learning curve to unlock the real power and convenience of the platform.

As remote work (i.e. "Working from Home") becomes the norm for many tech companies, Quanta offers a uniquely powerful way to collaborate on `Deep Documents` uniquely better and easier than what other team collaboration systems provide.

`Deep Documents` is a term that means documents which are structured content of arbitrary tree-depth, and are hierarchical, and can therefore potentially contain discussion threads like described above.

Importantly, these kinds of Deep Documents can also be powerful for their ability to preserve the thought processes, and discussions from all contributors, that led up to the final version of a document. This is obviously great for better accountability of decision making and for future reference regarding why a collaborative document ended up as it did.


----
**[Next: Application Layout](/docs/user-guide/app-layout/index.md)**
