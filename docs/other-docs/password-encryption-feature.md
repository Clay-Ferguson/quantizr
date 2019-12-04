# Password Encryption

Quantizr has a feature to support encrypting passwords, so that it can be conveniently used as a password manager. The way this works is that any node that you put a property named "sn:password" on will store the property value for "sn:password" in the DB as an encrypted string and it will never exist in clear text anywhere other than in browser.

It uses symmetric encryption to encrypt/decrypt the passwords. So there is one master password you'll be prompted with only once (per browser session) and it will be used to encrypt/decrypt all passwords.

The sn:password property should also be in a node whose type is: 'sn:passwordType', and when you do this the rendering of the node is done so that the 'sn:content' property becomes the label of a button for represending that node, and when you click the button it loads the decrypted password into your clipboard. This makes it easy to use the app to retrieve passwords to use to login to sites, apps. You never have to select and copy to clipboard yourself. Just click the button.

The browser 'window.crypto.subtle' API is the core encryption api, but you can see how it's used in Encryption.ts

    See also: PasswordPlugin.ts, PasswordDlg.ts, EditNodeDlg.java (search for 'encrypt')
    