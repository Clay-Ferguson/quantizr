package quanta.response;

import java.util.List;

import quanta.response.base.ResponseBase;

public class GetPeopleResponse extends ResponseBase {

    private List<FriendInfo> people;

    public List<FriendInfo> getPeople() {
        return people;
    }

    public void setPeople(List<FriendInfo> people) {
        this.people = people;
    }
}
