-- Billing details are asked for on paid orders only: a free start or a staff test purchase
-- records no state (GST place of supply), and accounts may have no name.
ALTER TABLE "CheckoutOrder" ALTER COLUMN "billingName" DROP NOT NULL,
ALTER COLUMN "billingState" DROP NOT NULL;
