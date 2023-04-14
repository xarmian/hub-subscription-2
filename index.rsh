'reach 0.1';

const myFromMaybe = (m) => fromMaybe(m, (() => [0,0]), ((x) => x));

export const main = Reach.App(() => {
  const Common = {
    ready: Fun([], Null),
  }
  const Deployer = Participant('Deployer', {
    ...Common,
    setParameters: Fun([],Tuple(UInt, Token, Address)), // amountPerBlock, token, claimAddress
  });
  const DAPI = API('DAPI', {
    subscribe: Fun([ UInt ], Null), // arg: amount of payment
    claim: Fun([Address], UInt), // arg: address to claim from, return: amount claimed
    cancel: Fun([], UInt), // arg: none, return: amount of token returned
  });
  const V = View({
    amountPerBlock: UInt,
    token: Token,
    claimAddress: Address,
    getUserInfo: Fun([Address], Tuple(UInt, UInt)),
  });
  const E = Events({
    notifySubscribe: [Address],
    notifyCancel: [Address],
  });

  init();

  Deployer.only(() => {
    const [ amountPerBlock, token, claimAddress ] = declassify(interact.setParameters());
    check(amountPerBlock > 0);
  });
  Deployer.publish(amountPerBlock, token, claimAddress);

  const userBalances = new Map(Address,Tuple(UInt, UInt)); // amount, lastClaimTime
  V.getUserInfo.set((m) => myFromMaybe(userBalances[m]));
  V.amountPerBlock.set(amountPerBlock);
  V.token.set(token);
  V.claimAddress.set(claimAddress);

  Deployer.interact.ready();

  const [ done ] = parallelReduce([ false ])
  .while(!done)
  .invariant(balance() == 0)
  .invariant(balance(token) == userBalances.reduce(0, (acc, [tk, _]) => acc + tk))
  .api(DAPI.subscribe,
    (amt) => {
      assume(amt > 0,"Amount must be greater than zero");
    },
    (amt) => [ 0, [ amt, token ] ],
    (amt, k) => {
      require(amt > 0);

      const [ curBalance, lastClaimTime ] = myFromMaybe(userBalances[this]);
      const newLastClaimTime = (lastClaimTime == 0) ? thisConsensusTime() : lastClaimTime;
      userBalances[this] = [ curBalance + amt, newLastClaimTime ];

      if (lastClaimTime == 0) E.notifySubscribe(this);

      k(null);
      return [ done ];
    })
  .api(DAPI.claim,
    (acct) => {
      assume(this == claimAddress,'Not deployer');
    },
    (_) => [ 0, [ 0, token ] ],
    (acct,k) => {
      require(this == claimAddress);

      const [ curBalance, lastClaimTime ] = myFromMaybe(userBalances[acct]);
      const rem = curBalance % amountPerBlock;
      const useBal = curBalance - rem;

      // calc payout amount
      const numBlocks = thisConsensusTime() - lastClaimTime; // blocks elapsed since last claim
      const maxBlocksPayable = useBal / amountPerBlock;

      const amtPaid = (numBlocks > maxBlocksPayable) ? maxBlocksPayable * amountPerBlock : numBlocks * amountPerBlock;
      require(balance(token) >= amtPaid);
      const newLastClaimTime = lastClaimTime + (amtPaid / amountPerBlock); // move lastClaimTime forward
    
      userBalances[acct] = [ curBalance - amtPaid, newLastClaimTime ];
      transfer([0, [ amtPaid, token ]]).to(claimAddress);

      k(amtPaid);
      return [ done ];
    })
  .api(DAPI.cancel,
    () => {
      const [ _, lastClaimTime ] = myFromMaybe(userBalances[this]);
      assume(lastClaimTime > 0);
    },
    () => [ 0, [ 0, token ] ],
    (k) => {
      const [ curBalance, lastClaimTime ] = myFromMaybe(userBalances[this]);
      require(lastClaimTime > 0);

      // calc amount owed
      const numBlocks = thisConsensusTime() - lastClaimTime;
      const amountOwed = numBlocks * amountPerBlock;

      if (amountOwed >= curBalance) {
        transfer([0, [ curBalance, token ]]).to(claimAddress);
      }
      else {
        transfer([0, [ amountOwed, token ]]).to(claimAddress);
        transfer([0, [ curBalance - amountOwed, token ]]).to(this);
      }

      userBalances[this] = [ 0, 0 ];
      const amtReturned = (amountOwed >= curBalance) ? 0 : curBalance - amountOwed;
      E.notifyCancel(this);
      k(amtReturned);
      return [ done ];
    });


  commit();
  Anybody.publish();
  transfer([balance(), [balance(token), token]]).to(Deployer);
  commit();

  exit();
});
