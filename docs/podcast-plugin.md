# Podcast Plugin

The Quanta platform is extensible for adding new "Node Types" which allows custom functionality to be added without altering the core codebase. Currently plugins however *do* require a full rebuild of the source, so they are not actually true plugins yet in the ordinary sense of the word.

Primarily only as a demonstration of the technology, we have added a node that contains a list of podcasts, which is here:

https://quanta.wiki/r/rss

The structure of that content is that it is one parent node where each child is an actual "Podcast Node Type". Each podcast node, when opened in your browser, runs the necessary TypeScript go query for the latest podcasts from each feed, and displays them all by running code only in your broser. Also the last *time offset* is continually updated as you listen so that you can close any audio stream, and then any time you ever open that stream again it resumes playing where it left off.

NOTE: The node containing the feeds published at the "/r/rss" location (link above) has been exported and is available at the following project location ./data/podcast-feeds-exported.zip. This zip file is in the import/export format for quanta.wiki, and can be imported back into Quanta.