/* We try to use rss-parser NPM package as our parser, but it fails when the feed source xml has
syntax errors (which about 10% of feeds out in the wild do have), so we fallback to using this
imprecise clunky feed parser whenever we encounter an erroneous feed, which will do a good enough
job for us. */

export interface RSSReaderIntf {
    readFeed(feedSrc: string, callback : Function): void;
}
