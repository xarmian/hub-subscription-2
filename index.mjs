import {loadStdlib} from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';
//import { exit } from '@reach-sh/stdlib';
const stdlib = loadStdlib(process.env);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const startingBalance = stdlib.parseCurrency(100);

const [ accDeployer, accAttacher1, accAttacher2, accClaimer ] =
  await stdlib.newTestAccounts(4, startingBalance);
console.log('Deployer and Attachers Created');

console.log('Launching Contract...');
const ctcDeployer = accDeployer.contract(backend);
const ctcAttacher1 = accAttacher1.contract(backend, ctcDeployer.getInfo());
const ctcAttacher2 = accAttacher2.contract(backend, ctcDeployer.getInfo());
const ctcClaimer = accClaimer.contract(backend, ctcDeployer.getInfo());

const tok = await stdlib.launchToken(accDeployer,"Zorks", "ZORKS", { supply: 100000, decimals: 0 });
await accDeployer.tokenAccept(tok.id);
await accAttacher1.tokenAccept(tok.id);
await accAttacher2.tokenAccept(tok.id);
await accClaimer.tokenAccept(tok.id);

await stdlib.transfer(accDeployer,accAttacher1,50000,tok.id);
await stdlib.transfer(accDeployer,accAttacher2,50000,tok.id);

console.log(`Deployer has a balance of ${await accDeployer.balanceOf(tok.id)} ZORKS and address ${stdlib.formatAddress(accDeployer.getAddress())}`);
console.log(`Attacher1 has a balance of ${await accAttacher1.balanceOf(tok.id)} ZORKS and address ${stdlib.formatAddress(accAttacher1.getAddress())}`);
console.log(`Attacher2 has a balance of ${await accAttacher2.balanceOf(tok.id)} ZORKS and address ${stdlib.formatAddress(accAttacher2.getAddress())}`);
console.log(`Claimer has a balance of ${await accClaimer.balanceOf(tok.id)} ZORKS and address ${stdlib.formatAddress(accClaimer.getAddress())}`);

console.log('Starting backends...');

backend.Deployer(ctcDeployer, {
  setParameters: () => {
    console.log('parameters set');
    return [ 1, tok.id, accClaimer.getAddress() ];
  },
  ready: async () => {
    console.log('contract is ready');
    await runTestingScenario();
    
    // sleep 10 seconds to allow events to be seen
    await sleep(10000);
    process.exit(0);
  }
});

// initialize event monitors
ctcDeployer.e.notifySubscribe.monitor(({when, what}) => {
  console.log(`Subscription Event! Address: ${stdlib.formatAddress(what[0])} at block ${stdlib.bigNumberToNumber(when)}`);
});

ctcDeployer.e.notifyCancel.monitor(({when, what}) => {
  console.log(`Cancellation Event! Address: ${stdlib.formatAddress(what[0])} at block ${stdlib.bigNumberToNumber(when)}`);
});

const runTestingScenario = async () => {
  // attacher1 use view to see contract parameters
  const amtPerBlock = await ctcAttacher1.v.amountPerBlock();
  const token = await ctcAttacher1.v.token();
  const claimAddress = await ctcAttacher1.v.claimAddress();
  console.log(`Attacher1 sees.. amountPerBlock: ${amtPerBlock[1]}, tokenID: ${token[1]}, claimAddress: ${stdlib.formatAddress(claimAddress[1])}`);

  // attacher 1 join contract
  await ctcAttacher1.a.DAPI.subscribe(2000);
  const userInfo = await ctcAttacher1.v.getUserInfo(accAttacher1.getAddress());
  console.log(`Attacher1 has subscribed and sees balance of ${stdlib.bigNumberToNumber(userInfo[1][0])} and last claim/start block of ${stdlib.bigNumberToNumber(userInfo[1][1])}`);

  // Claimer claim a few times
  await ctcClaimer.a.DAPI.claim(accAttacher1.getAddress());
  await ctcClaimer.a.DAPI.claim(accAttacher1.getAddress());
  await ctcClaimer.a.DAPI.claim(accAttacher1.getAddress());
  console.log(`Claimer's Balance: ${await accClaimer.balanceOf(tok.id)} ZORKS`);

  // attacher 2 join contract
  await ctcAttacher2.a.DAPI.subscribe(2000);
  const userInfo2 = await ctcAttacher2.v.getUserInfo(accAttacher2.getAddress());
  console.log(`Attacher2 has subscribed and sees balance of ${stdlib.bigNumberToNumber(userInfo2[1][0])} and last claim/start block of ${stdlib.bigNumberToNumber(userInfo2[1][1])}`);

  // Claimer claim from both attacher 1 and 2
  await ctcClaimer.a.DAPI.claim(accAttacher1.getAddress());
  await ctcClaimer.a.DAPI.claim(accAttacher2.getAddress());
  console.log(`Claimer's Balance: ${await accClaimer.balanceOf(tok.id)} ZORKS`);

  // attacher 2 try to claim
  try {
    console.log(`Attacher2 attempt to claim...`);
    await ctcAttacher2.a.DAPI.claim(accAttacher2.getAddress());
    console.log(`ERROR: Attacher2 claimed funds!`);
  }
  catch(err) {
    console.log(`Attacher2 attempt to claim failed successfully`);
  }

  // attacher 1 cancel
  console.log(`Attacher1 Balance before cancel: ${await accAttacher1.balanceOf(tok.id)} ZORKS`);
  await ctcAttacher1.a.DAPI.cancel();
  console.log(`Attacher1 Balance after cancel: ${await accAttacher1.balanceOf(tok.id)} ZORKS`);
  console.log(`Claimer Balance after Attacher1 cancel: ${await accClaimer.balanceOf(tok.id)} ZORKS`);

  // attacher 2 adds more funds
  console.log(`Attacher2 Balance before adding more: ${await accAttacher2.balanceOf(tok.id)} ZORKS`);
  await ctcAttacher2.a.DAPI.subscribe(1000);
  console.log(`Attacher2 Balance after adding more: ${await accAttacher2.balanceOf(tok.id)} ZORKS`);
  const userInfo3 = await ctcAttacher2.v.getUserInfo(accAttacher2.getAddress());
  console.log(`Attacher2 contract balance is ${stdlib.bigNumberToNumber(userInfo3[1][0])} and last claim/start block of ${stdlib.bigNumberToNumber(userInfo3[1][1])}`);

  await ctcClaimer.a.DAPI.claim(accAttacher1.getAddress());
  await ctcClaimer.a.DAPI.claim(accAttacher2.getAddress());
  console.log(`Attacher1 Final Balance: ${await accAttacher1.balanceOf(tok.id)} ZORKS`);
  console.log(`Attacher2 Final Balance: ${await accAttacher2.balanceOf(tok.id)} ZORKS`);
  console.log(`Claimer Final Balance: ${await accClaimer.balanceOf(tok.id)} ZORKS`);
}
