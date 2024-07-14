**[Quanta](/docs/index.md) / [Quanta-User-Guide](/docs/user-guide/index.md)**

# Encryption

# Encrypting a Node

To encrypt a node, open the Node Editor, expand the "Advanced" section, and click the Encrypt checkbox. Once that checkbox is checked, the content will be encrypted, on the server, and only you and others you've shared it to will be able to see it. You can still edit the node, and every time you save the node it gets re-encrypted again.

The padlock icon will show up on the node to let you know it's encrypted.

You can visually verify that your data is being encrypted by selecting the encrypted node and using `Menu -> Info -> Show Raw Data`. The content property of the node will be the unreadable hexadecimal of the encrypted data, and this encrypted data is what's stored on the server. The server never sees the unencrypted text, so even in the event of a server security breach/hack, none of the encrypted data can ever be exposed.

# Technical Notes

The browser's built-in JavaScript Crypto API and RSA PKE (Public Key Encryption) is used. We use the industry-standard PKE scheme where neither the private key nor the un-encrypted text ever leaves the browser. This is commonly called "End-to-End" (E2E) encryption.

# Encryption Strategy

----

The following (below) is how the encryption scheme works. As an end user you don't need to know any of this, but for developers to understand the design we included this explanation.

First of all, this is the standard industry approach. This was not an algorithm invented by or specific to Quanta, but is just the basic PublicKey technique used by most systems that do E2E Secure Messaging.

Example scenario:

Let's say Alice has a secret message to share with two other users, Bob and Cory. All Alice has to do is check the 'Encrypt' checkbox in the editor and then add Bob and Cory using the sharing dialog.

What happens, technically, in the database is the following: When the node is encrypted the system generates a random encryption key (a Symmetric AES Key) just for that node so that only that key can decrypt the data. So then the question becomes how to make it so that ONLY Bob and Cory can ever be able to get that key to the data.

This is where Asymmetric (PublicKey) Encryption comes in. What Quanta automatically does is it encrypts the 'key' with Bob's PublicKey to get 'bobsKey' and then encrypts the key again with Cory's PublicKey to get 'corysKey' and attaches both bobsKey and corysKey onto the node. Both of those can be completely public.

So now when either Cory or Bob view that node, they, and only they, can use each of their Private Keys to decrypt the key to the data. Once they can decrypt the key to the data they can then see the data, but only them and no one else. 

Also this all happens automatically. Both Bob's browser and Cory's browser automatically recognize they have the key to the data, and everything is done automatically to allow them to read the message. None of the parties involved had to do anything "manually" with keys. 

In case that was confusing here's the gist of the tricky parts: When data is encrypted with a PublicKey of a keypair then only the PrivateKey (of that keypair) can decrypt that data. And the inverse is also true. When the PrivateKey encrypts some data then only the matching PublicKey can decrypt the data. Based on this logic people can securely communicate encrypted data without a need to secretly send 'passwords' to each other. This entier strategy is what's commonly referred to as "Public Key Encrytion".

# Key Management

todo: Docs below need to be updated because the new Security Keys Dialog is a slightly different process than what's described below:

As an end user, you don't normally need to worry about security keys. Your browser will automatically generate your PKE security key for you. Your browser always has one single PKE key-pair (created by Quanta) that's for Quanta encryption, decryption, and identifying you.

However if you're dealing with important data, you will want to save your key info out of the browser and into some safe location in case you ever need to reinstall your browser, or reinstall your OS or for whatever other reason. To do this there's an "Encrypt" menu that lets you view your keys, generate new keys, re-publish your public key, or import a saved copy of your keys.

Warning: If you use the `Encrypt -> Generate Keys` that means you want to intentionally throw away your old keys. So, unless you've saved them in a text file yourself (by copying out of the 'Show Keys' dialog), then you'll never be able to decrypt any of the data that you had encrypted with the old keys. 

So don't use the Generate Keys function unless you know what you're doing, or know you don't have any encrypted data you might be about to loose access to because you didn't already export your currently existing keys.

For this reason it's a good idea to save the content of the 'Show Keys' dialog into a text file just in case you do accidentally run "Generate Keys" and overwrite your keys. If you have your keys saved you can put them back in with 'Import Keys' and once again get access to any data encrypted with those keys, at any point in the future. Just remember never to share the "Private Key" section of that text because whoever has that can decrypt your data and/or potentially masquerade as you.

Caveat/Warning: If user 'A' encrypts a node and then shares with user 'B', this will work, and user 'B' can see the decrypted content unless/until user 'B' regenerates his security keys, using `Encrypt -> Generate Keys` menu item. After user 'B' regenerates his keys, user 'A' will have to open the shared (encrypted) node and click 'Save' again, in order for 'B' to continue being able to read the content.

This is a minor limitation, and will be made easier to use in a future release of the app.


----
**[Next: Interactive-Graphs](/docs/user-guide/graphs/index.md)**
