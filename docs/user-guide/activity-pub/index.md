**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

* [Social Media and Fediverse](#social-media-and-fediverse)
    * [How to Post](#how-to-post)
    * [Reply to a Post](#reply-to-a-post)
    * [Direct Messages ](#direct-messages-)
    * [Threading Model](#threading-model)
    * [Trending Topics](#trending-topics)
    * [Fediverse Search](#fediverse-search)

# Social Media and Fediverse

Quanta has a decent set of Fediverse features that allow you to follow other Fediverse users and publish your own content onto the Fediverse, however Quanta is not a 'full featured' and dedicated Social Media app (like Mastodon for example).

The `Feed Tab` shows a reverse-chronological view of the Fediverse, as well as content from your local instance. This tab is similar to the rev-chron timelines in Twitter, Mastodon, and other social media apps. 

On the right hand side of the app you'll find various feed filtering options, like `My Mentions`, `To/From Me`, `To Me`, etc., that allow you to narrow down whatever specific content you'd like to see.

To browse the entire Fediverse (or at least all content your instance knows about), click `Feed -> Fediverse`.

# How to Post

To post a simple public message do the following: Switch to `Feed View [1]`, click `Post [2]` button, enter some `content [3]`, and click `Save [4]`

<img src='attachments/6286a95e835ea539a4c45051-file-p' style='width:100%'/>


You can find people and mention people by using their username formatted like `@bob@quanta.wiki`. 

You can shorten the name to `@bob` to refer to other users on your same instance, but when mentioning or searching for users on other foreign servers use the long version of their username.

When you use the `Post` button on the Feed tab, to post to the Fediverse, this creates a new node under your "Public Posts" node. 

There's nothing special about the "Public Posts" node other than it's the default place where the Feed Tab's `Post` button puts your new top-level posts. To view that node directly, and see all your top-level posts, click `Folders -> My Posts`.

# Reply to a Post

Each message in the feed tab has a "Reply" button just like what you will recognize from other social media apps. You can click the reply button to reply to a post.

**How replying works:**

When you reply to a node the reply itself always is stored on the tree as a 'subnode' under (i.e. child node of) the node you're replying to, and it will default to having the same "Sharing Settings" as the node being replied to. This means the 'visibility' (i.e. who can see it) of the reply will by default inherit the sharing settings from the parent. So when you're replying to something private, between you and someone else, it will stay private, by default.

However any time you're editing a node you can always alter the Sharing on it to make it as public or private as you want, before clicking 'Save'. Just beware that when you mention someone (like this: @bob) in the content text the node will be shared with that person as well.

# Direct Messages 

You can DM (Direct Message) a user by clicking the "Message" button on their Profile Dialog, which can be accessed by clicking their avatar. 

Another way to post a DM to someone is to just create a node, and add only that person to the sharing for the node. This will make that node appear in the other user's feed no matter where you created your node, and when they reply to it their reply will come in as a new subnode under the node you shared to them. 

Finally there's the most common way of sharing a node to someone which is to simply mention their name like "@bob@quanta.wiki" in the content text.

# Threading Model

If all of the above made sense to you, you may now realize every node can be the root of a "Discussion Thread". There's no need to specifically create a "Discussion Thread" in Quanta, because every node can have an arbitrarily large discussion under it, just by being a branching point on the tree.

This solves lots of awkwardness that other social media apps have related to the challenge of how to know *what* someone is intending to reply to when they post content into a 'room'. Quanta never has this *problem* because you can always assume the parent of any node is the node being *replied to*. 

Another powerful aspect of this `tree-based threading model` is how powerful it makes the `Timeline` feature. Not only is every node potentially a conversation thread, but you can request a `Rev-Chron View` of any node to see just the chronological history of what's under that specific node itself. 

So in general whenever you want to see what's the latest activity under any section of the tree you just run a Timeline on it (clock icon at top of page). This is explained in other sections of this User Guide in slightly more detail as well.

see also: [Timelines](/docs/user-guide/timelines/index.md)

# Trending Topics

To search for content you're interested in, click `Trending -> Hashtags` which will open up a Tab containing something like the following image (below). You can click on any term/word to view all the content that has been recently posted about it.

The Trending Analysis is run automatically by the server every couple of hours, and its statistical universe of content is the most recent 10,000 posts from all users.

The screenshot below was taken on Feb.15,2023 so what you're seeing in the image below is what most people on the Fediverse were talking about on that day, ranked from left to right, top to bottom, in exact order of frequency of usage.

Note: There's a URL specifically to go to the Trending Tab which is the following:

* https://quanta.wiki?view=trending

<img src='attachments/63ed65fd32831373361c32d2-file-p' style='width:100%'/>


# Fediverse Search

How to search for content in the Feed View

Search the Fediverse for tags, users, or text using these three steps. 

First make sure you have selected a "Feed" option on the right hand side, so you're on the Feed Tab, and then enter some text to search and click the "Search" button.

<img src='attachments/6286cb62a487d37f9988508a-file-p' style='width:100%'/>


Your Feed View will now show search results, until you click the "Clear" button, or search for something else.

<img src='attachments/6286cd14a487d37f998850d9-file-p' style='width:100%'/>



----
**[Next Page -> ChatGPT AI](/docs/user-guide/ai/index.md)**
