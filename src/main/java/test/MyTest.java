package test;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import static org.junit.Assert.assertEquals;

@RunWith(JUnit4.class) // This tells JUnit to run the test using JUnit4 runner
public class MyTest {

    @Test
    public void testAddition() {
        int a = 5;
        int b = 10;
        assertEquals(16, a + b);
    }

    @Test
    public void testSubtraction() {
        int a = 10;
        int b = 5;
        assertEquals(5, a - b);
    }
}
