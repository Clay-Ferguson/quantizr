**[Quanta](/docs/index.md) / [Quanta User Guide](/docs/user-guide/index.md)**

* [Timelines](#timelines)
    * [Terminology](#terminology)
    * [Powerful Collaboration](#powerful-collaboration)
    * [Practical Use Cases](#practical-use-cases)
    * [Timeline Sort Options](#timeline-sort-options)
        * [Created](#created)
        * [Modified](#modified)
        * [Created non-Recursive](#created-non-recursive)
        * [Modified non-Recursive](#modified-non-recursive)

# Timelines

View a rev-chron listing of the subgraph under any node.

In the context of the Quanta platform, we have a very specific meaning for the term `timeline`. A `timeline` is defined as the reverse-chronological listing of the entire recursive subgraph under any branch of the tree. 

In other words a `timeline` consists of everything (every node) under that branch of the tree presented as a list (not a tree), with the newest on top". A common abbreviation for this is "rev-chron".

# Terminology

Although the term 'timeline' has become associated with Social Media feeds in recent years, the term timeline, as used in Quanta, is a more specific feature and just means some rev-chron list, generated by the user 'on demand' similar to a type of 'search results' view.

So you can "View a Timeline" of any node that just means generating this rev-chron, and displaying it in the "Timeline Tab".

Quanta does have a Social Media Feed, but that's under the 'Feed Tab', and it's not generally referred to as a `timeline` but is referred to as a `feed`.

# Powerful Collaboration

Timelines give you a powerful way to find out what the newest content is under any branch of the tree, with a single click. This is extremely useful for collaborative document editing.

Below is an example showing how we can add a node at some random location on an arbitrarily large tree of content (War and Peace, in this case), and then rapidly find it again just by opening a Timeline View of any ancestor node at any level higher up in the tree.

Below shows our test node I created to demonstrate how we can find it again using a Timeline View. The node that starts with `"I'm adding this node..."` (in the image below) was created at a random location just to prove we can easily find it again.

Since this node is the newest (when these screenshots were taken) the newest node should appear at the top of any timeline which would contain it, as we see below.

<img src='attachments/6287d57896d3696042d5d75a-file-p' style='width:100%'/>


Now we go all the way up to the root node of the book `War and Peace` and Click the `Clock Icon (to generate a Timeline)`

<img src='attachments/6287d5f996d3696042d5d773-file-p' style='width:100%'/>


As expected, the newest node is always at the top of the rev-chron list, so this has found the most recent content, and it's what we just added of course. You'll also notice the app switched over to the `Timeline Tab`, but we can always go back to the Folders tab any time.

<img src='attachments/6287d6bb96d3696042d5d792-file-p' style='width:100%'/>


We could have also searched from anywhere else on the tree that's still above the node in question, in the hierarchy. So let's do that. We'll go directly to Book 7 and run a Timeline again on Book 7. Since our latest change was indeed somewhere down inside Book 7 as well, we can use Timeline again to find the node again.

<img src='attachments/6287d73d96d3696042d5d79c-file-p' style='width:100%'/>


So here is our node again, in a different set of results, but still at the top since it's still the most recent thing under Book 7.

<img src='attachments/6287d7c896d3696042d5d7a3-file-p' style='width:100%'/>


# Practical Use Cases

If you're working collaboratively with a team on a document (with multiple other people), you can view a timeline to see everyone's latest contributions to the document (or even just a sub-section of the doc), as a rev-chron list. With one click you can also jump from the rev-chron listing (aka. Timeline) to the actual node in the main content tree.

The Timeline capability is also useful for reading discussion threads and allows you to quickly find all the latest posts in any large social media thread. 

This is true because the "reply" button on any node will create a subnode under the node you're replying to, and so this builds up a tree structure that organizes the conversation very well. So the Timeline View is a way to view the tree not as a tree but as a rev-chron list.

# Timeline Sort Options

You can generate a timeline based on when nodes were first created, or when nodes were last modified. Usually the "Last Modified" option is what you want so that any recently edited nodes will show up near the top based on the time they were last edited, which is usually more important than the time when the node was first created.

Use `Menu -> Timeline` for the following other sort options.

## Created

Displays a timeline based on each subnode's creation time.

## Modified

Displays a timeline based on each subnode's modification time.

## Created non-Recursive

Displays the timeline (by node create time) just for the direct child nodes of the current node.

## Modified non-Recursive

Displays the timeline (by node modification time) just for the direct child nodes of the current node.


----
**[Next: Chat Rooms](/docs/user-guide/chat-rooms/index.md)**
