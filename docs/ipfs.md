# Quanta: A future IPFS Browser and Search Engine ?

## (IPFS: Interplanetary File System)

IPFS technology is now integrated into Quanta, as a proof-of-concept, and the docker deployment and usage is working in a simple trivial test case, for running some IPFS code.

The next version of Quanta will have features to read and write to the IPFS Internet, which is the new "distributed web" everyone has been talking about recently. IPFS is what is going to "take back the web" from the monopolies (FANGT) that currently get to control the lives of us all, and control what we can see, what we can hear, and even censor what we can say. 

It's beyond the scope here to describe anything further about IPFS, but the main thing you need to know about IPFS is that it's built on the same technology as Blockchains, and is distributed and uncensorable, just like Bitcoin. 

Quanta uses MongoDB for all it's own data storage, and that is actually a good thing (and needed) even with IPFS, because this MongoDB database will function as a cache/index for doing full-text search, and sorting, of IPFS data. So the way to think of Quanta is that it will be a participant on the IPFS web, will be usable as a way to browse the IPFS web, and will also serve as a very powerful "search engine" for the IPFS Web! 

That is, the Quanta app will be able to "crawl" IPFS trees (MerkleDAGs), and index the data as it goes along by caching in it's own local MongoDB. The the actual search requests, and/or future browsing of the same content will then come directly out of the MongoDB. So think of Quanta also as the final top layer of caching for IPFS data, where it can be rapidly surfaced to the Quanta front-end even without accessing IPFS for every access.

## Note

See file named `ipfs-quanta-testing.md` for info regarding technical specifics involved in running an IPFS Gateway instance inside the Quanta Docker compose and doing a very simple 'end-to-end' test of the IPFS Gateway, from the GUI.

## Quanta: The IPFS Browser

Quanta has a very rudimentary experimental IPFS Browsing capability, that's capable of letting users browse the IPFS Web exactly as if that web were just a branch on the Quanta tree.

The Quanta back end allows nodes to be created by the end user and then configured to point to specific nodes on the IPFS "tree" (or "MerkleDAG" in the IPFS parlance). Quanta reads nodes from IPFS as needed, and caches the content into the Quanta MongoDB exactly the way all non-IPFS content is stored in its MongoDB tree. This means that we get the extra benefit that we can "Full Text" search any and all information that has thus far been "encountered".

## IPFS Code for Quanta Connectivity

Below are links to the main IPFS code in Quanta that caches IPFS into MongoDB:

https://github.com/Clay-Ferguson/Quanta/blob/master/src/main/java/org/subnode/service/IPFSService.java

# IPFS Crawler (IPFS Search Engine)

Currently Quanta only loads IPFS nodes upon demand so if no user has yet nagivated to a particular IPFS node, then it won't be loaded into Quanta or searchable yet, but this also means that it will be quite trivial to make the Quanta IPFS reader run recursively and crawl the IPFS web, which essentially turns Quanta itself into an IPFS Search Engine. With a large enough MongoDB datastore truly massive amounts of data, could be indexed and it would essentially be a "Google" for the IPFS Web. The only limits on performance would be the limits of MongoDB itself.

# Freedom from Google Monopoly on Search

Of course Google is also going to be able to provide this same functionality, and will be themselves indexing the IPFS Web, but the difference is that Quanta is open source and can be run by any company at any data center, and so this removes monopoly power from Google over the world's "search". No more censoring. No more shady business practices of altering search results based on political agendas of the Silicon Valley brass, etc.

# HOW TO: Read IPFS in Quanta

Create a normal Quanta node and set it's type to "ipfs:node" (i.e. edit the node and choose that type form the list), then create a property named "ipfs:link" on this node containing a Base58 hash string as it's value (something like QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB for example). 

After doing this Quanta will automatically read the content from the IPFS Web, and cache it into the local MongoDB, and you can then view the content on that node and it will appear to be just a normal part of the Quanta tree.

# IPFS Hashes

Gateway URL Examples: 

http://localhost:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme

https://gateway.ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme

These are just various test nodes that the developers of IPFS have put out and made available
for basic testing

Readme:
    QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme

Welcome:
     QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB

Video:
    QmVc6zuAneKJzicnJpfrqCH9gSy6bz54JhcypfJYhGUFQu/play#/ipfs/QmTKZgRNwDNZwHtJSjCp6r5FYefzpULfy37JvMt9DwvXse

Images:
    QmZpc3HvfjEXvLWGQPWbHk3AjD5j8NEN4gmFN8Jmrd5g83/cs

# IPFS Links and Info

https://ipfs.github.io/public-gateway-checker/

https://ipfs.io
https://discuss.ipfs.io
https://docs.ipfs.io/reference/api/http
https://www.reddit.com/r/ipfs

# IPFS Tips, Terms, Cheatsheet

Two main operations to retrieive data: 'get' or 'cat'

# Where is Data Stored

Data is stored at the IPFS_PATH environment variable location.

From ipfs daemon --help:

USAGE
  ipfs daemon - Run a network-connected IPFS node.
...
  IPFS_PATH environment variable

  ipfs uses a repository in the local file system. By default, the repo is
  located at ~/.ipfs. To change the repo location, set the $IPFS_PATH
  environment variable:

      export IPFS_PATH=/path/to/ipfsrepo
...

# Cleaning up the IPFS Node

You can run a GC to delete everything not pinned.
