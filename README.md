Reach.sh Subscription Challenge

This contract acts as a subscription stream,
where multiple users (wallets) can subscribe simultaneously.
The contract accepts the following parameters upon deployment as a Tuple:

- Subscription amount per block
- Token ID to be used
- Address authorized to claim

The stream allows a user to activate a subscription with a small amount of tokens
then add additional tokens later. If the user's token balance runs out, the "clock"
will continue to run so that the full amount may be claimed once their balance is topped off.

Concepts Demonstrated:
- Tracking of multiple subscriptions from different users
- Canceling of subscriptions
- Adding additional funds to active subscriptions
- Views for parameters and user balances
- Events for subscriptions and cancellations