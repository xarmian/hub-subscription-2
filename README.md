Reach.sh Subscription Challenge - Level 2

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

Deviation from Initial Spec
- The Level 2 spec sheet specifies that a year's worth of tokens should be transferred
to the contract when a user subscribes. This contract takes a slightly different approach
by allowing a user to subscribe with any amount of tokens (> 0) and top-up their
subscription on an ongoing basis.