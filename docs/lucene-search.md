# Lucene Search

Quantizr has an experimental capability to do File System indexing/searching using Lucene & Tika. 

## Technical Notes

The indexing and searching code can be found in the `org.subnode.lucene` package. 

### Features

* Recursively indexes an eitire directory structure
* Allows input parameter for a comma delimited list of file extensions to be indexed.
* Uses "Apache Tika" to extract text content from any type of file
* Explores recursively into (most) types of archive files, including Zip files, TAR files, GZipped TARs.

## How to Index files and Search

How to index a folder (recursively) and then do a search against it. This is a very mimimalistic minimum-viable-product type of proof-of-concept for a Lucene index feature, but 99% of the architecture is in place and provable working.

1) Add "application.properties" property getLuceneDir which will hold the data files for the lucene index.
2) Create a new Node and Set it's type to 'luceneIndex'
3) Add 'searchDir' as a property on this node, and put in it the value of the (docker available) folder you want to search.
4) Go to this node and click the 'Reindex' button that will appear inline in that node. This will synchronously run the Lucene indexer to index the entire content of the 'searchDir' folder.
5) Now you can click 'Search' button and enter a search string, and it will search using the Lucene index and display the names of the matching documents, in a popup window.
