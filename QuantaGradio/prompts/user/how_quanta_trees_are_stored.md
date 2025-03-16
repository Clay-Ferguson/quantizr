meta_begin
# Experimental Prompt/Briefing

The purpose of the prompt below is to verify that we can use `Named Blocks` and/or long preambles in a discussion with AI to explain some architectural details similar to what you would provide to a new employee at a company getting started on working on a specific bug or feature. Instead of throwing the entire codebase at someone unfamiliar with it, you'd normally would provide specific files and chunks of files (Named Blocks!) and describe how some aspect of the overal codebase (i.e. application) to a developer, for them to focus on. This is great for AIs as well, because similar to how humans have limited ability to simply 'injest' and entire codebase and understand it (related to short term memory in humans, etc), we have a similar issue with context length in AIs and so providing them a way to focus on a specific aspect of a codebase helps them AI just like it helps a human.

## The Challenge - Look for Path-related Bugs in Quanta

We will use the following prompt below to get the AI up to speed on how just the path aspect of Quanta works. That is we want a prompt chunk that explains how Nodes on the Quanta Tree use a path, similar to a "file system" path.

## The Prompt
meta_end

As you know you're a software agent helping me work on code. For today we're working in Java, on a product called Quanta, which functions similar to Jupyter Notebooks in that it's a "Block Base" (i.e. cell-based) editor. However Quanta uses a "Tree" of content, so every block/cell is saved as a Node on the Tree. Each Node is stored in MongoDB, using the document class you'll find in `SubNode.java`. To make each of these documents have a location on the Tree, we use the `path` property in `SubNode` class. Each path must of course be unique, and similar to "file systems" a forward slash ('/') is used as the delimiter of the path elements. 

Each Tree Node (i.e. `SubNode` instance) also has an `ordinal` property, which defines the position relative to the parent, because our Tree Children are "ordered". This ordinal property doesn't need to contain contiguous numbering, but we simply define that the sort order of the integer `ordinal` values of the children under any Node is what determines their ordering.

Note that our Node object doesn't directly store child nodes under it in memory. When we need the direct children under a given node assume you should use method `getChildren(SubNode node)` in file `MongoRead.java`

Given the above, please check `moveNodeUp(SubNode node)` and let me know if you see any bugs.

meta_begin
ONE OR THE OTHER:

OPTION 1: To show that you understand this stuff so far, please write the code to create a small tree structure that has a root node, with two child nodes, and then each of those two child nodes has two child nodes also. Don't worry about persistence to the DB yet. Just show the code to create this tiny tree, and don't explain any of it.

OPTION 2: Given the above, please check `moveNodeUp(SubNode node)` and let me know if you see any bugs.
meta_end
