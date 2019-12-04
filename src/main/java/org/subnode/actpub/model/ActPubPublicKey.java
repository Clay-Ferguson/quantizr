package org.subnode.actpub.model;

public class ActPubPublicKey {
    private String id;
    private String owner;
    private String publicKeyPem;

    public String getId() {
        return id;
    }

    public String getPublicKeyPem() {
        return publicKeyPem;
    }

    public void setPublicKeyPem(String publicKeyPem) {
        this.publicKeyPem = publicKeyPem;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public void setId(String id) {
        this.id = id;
    }
}
