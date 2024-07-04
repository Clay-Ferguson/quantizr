package quanta.service;

import java.math.BigDecimal;
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

@Controller
public class StripeController extends ServiceBase implements ErrorController {
    private static Logger log = LoggerFactory.getLogger(StripeController.class);

    @PostMapping("/stripe/webhook")
    public ResponseEntity<String> handleStripeEvent(@RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        log.debug("Stripe Event: " + payload);

        String apiKey = prop.getStripeApiKey();
        if (StringUtils.isEmpty(apiKey)) {
            log.error("No Stripe API Key defined");
            return ResponseEntity.badRequest().body("Bad Request: No Stripe API Key");
        }

        String endpointSecret = prop.getStripeEndpointKey();
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
            exec.run(() -> {
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
                            arun.run(as -> {
                                BigDecimal dollarsAmount = new BigDecimal(amount).divide(new BigDecimal(100));
                                user.addCreditByEmail(as, _customerEmail, dollarsAmount, checkoutSession.getCreated());
                                return null;
                            });
                        } else {
                            log.error("Bad Request: Invalid Payload");
                        }
                        break;
                    default:
                        break;
                }
            });
        } catch (Exception e) {
            log.error("Stripe Error", e);
        }
        return ResponseEntity.ok().build();
    }
}

