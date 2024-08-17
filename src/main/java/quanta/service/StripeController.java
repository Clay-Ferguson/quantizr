package quanta.service;

import java.math.BigDecimal;
import java.util.Calendar;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import quanta.config.ServiceBase;
import quanta.postgres.table.Tran;
import quanta.util.FileUtils;
import quanta.util.Util;

@Controller
public class StripeController extends ServiceBase implements ErrorController {
    private static Logger log = LoggerFactory.getLogger(StripeController.class);
    private static int entryCounter = 0;

    @PostMapping("/stripe/webhook")
    public ResponseEntity<String> handleStripeEvent(@RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            entryCounter++;
            log.debug("Stripe Event: " + payload);

            String apiKey = svc_prop.getStripeApiKey();
            if (StringUtils.isEmpty(apiKey)) {
                log.error("No Stripe API Key defined");
                return ResponseEntity.badRequest().body("Bad Request: No Stripe API Key");
            }

            String endpointSecret = svc_prop.getStripeEndpointKey();
            if (StringUtils.isEmpty(endpointSecret)) {
                log.error("No Stripe Endpoint Secret defined");
                return ResponseEntity.badRequest().body("Bad Request: No Endpoint Secret");
            }

            Stripe.apiKey = apiKey;
            try {
                Event event = null;
                try {
                    event = Webhook.constructEvent(payload, sigHeader, endpointSecret);
                } catch (SignatureVerificationException e) {
                    return ResponseEntity.badRequest().body("Bad Request: Invalid Signature");
                } catch (Exception e) {
                    return ResponseEntity.badRequest().body("Bad Request: Invalid Payload");
                }

                Event _event = event;

                // run the processing in an async thread, because we need to return immediately for Stripe.com to
                // see this endpoint as immediately responsive
                entryCounter++;
                svc_async.run(() -> {
                    try {
                        switch (_event.getType()) {
                            case "checkout.session.completed":
                                EventDataObjectDeserializer dataObjectDeserializer = _event.getDataObjectDeserializer();
                                if (dataObjectDeserializer.getObject().isPresent()) {
                                    Session checkoutSession = (Session) dataObjectDeserializer.getObject().get();

                                    String customerEmail = checkoutSession.getCustomerEmail();
                                    if (customerEmail == null && checkoutSession.getCustomerDetails() != null) {
                                        customerEmail = checkoutSession.getCustomerDetails().getEmail();
                                    }
                                    if (customerEmail != null) {
                                        log.debug("Customer email: " + customerEmail);
                                    } else {
                                        log.debug("Customer email was not provided in the session.");
                                    }

                                    Long amount = checkoutSession.getAmountTotal();
                                    if (amount != null) {
                                        log.debug("amount: " + amount);
                                    }
                                    if (amount == null || amount == 0) {
                                        log.error("Bad Stripe Request: No Amount");
                                    }

                                    String _customerEmail = customerEmail;
                                    svc_arun.run(() -> {
                                        BigDecimal dollarsAmount = new BigDecimal(amount).divide(new BigDecimal(100));
                                        // todo-2: I'm getting bad dates from 'getCreated()', so for now we set to a
                                        // time we generated ourselves
                                        Long now = Calendar.getInstance().getTime().getTime();
                                        String logFile = "stripe-payment-" + now + ".json";
                                        FileUtils.writeFile(logFile, payload, false);
                                        svc_email.sendDevEmail("Stripe Payment Recieved from " + _customerEmail,
                                                "Amount: " + dollarsAmount + "\nLog File: " + logFile);
                                        try {
                                            Tran tran = svc_pgTrans.addCreditByEmail(_customerEmail, dollarsAmount, now); // checkoutSession.getCreated());
                                            FileUtils.writeFile(logFile,
                                                    "\n\nSTATUS: Saved OK: \n\nTran Record ID=" + tran.getId(), true);
                                        } catch (Exception e) {
                                            log.error("Error adding credit to user", e);
                                            FileUtils.writeFile(logFile,
                                                    "\n\nSTATUS: DB Save Failed: \n\n" + e.getMessage(), true);
                                        }
                                        return null;
                                    });
                                } else {
                                    log.error("Bad Request: Invalid Payload");
                                }
                                break;
                            default:
                                break;
                        }
                    } finally {
                        entryCounter--;
                    }
                });
            } catch (Exception e) {
                log.error("Stripe Error", e);
            }
            return ResponseEntity.ok().build();
        } finally {
            entryCounter--;
        }
    }

    public static void waitForTransactions() {
        while (entryCounter > 0) {
            log.debug("Waiting for StripeController.entryCounter " + entryCounter);
            Util.sleep(100);
        }
    }
}

