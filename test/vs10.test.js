const hre = require("hardhat");
var chaiAsPromised = require("chai-as-promised");

const {assert} = require("chai").use(chaiAsPromised);
const {time} = require("@openzeppelin/test-helpers");
const {web3} = require("@openzeppelin/test-helpers/src/setup");

const Controller = hre.artifacts.require("Controller");
const VS10Pool = hre.artifacts.require("VS10Pool");
const ERC20 = hre.artifacts.require("ERC20");

const VFixedStrategy = hre.artifacts.require("VFixedStrategy");

const unlockAccount = async (address) => {
  await hre.network.provider.send("hardhat_impersonateAccount", [address]);
  return address;
};

const toWei = (amount, decimal = 18) => {
  return hre.ethers.utils.parseUnits(hre.ethers.BigNumber.from(amount).toString(), decimal);
};

const fromWei = (amount, decimal = 18) => {
  return hre.ethers.utils.formatUnits(amount, decimal);
};

describe("VS10 Fixed pool test", () => {
  let vs10Pool, controller, strategy;

  let vvsp = "0xbA4cFE5741b357FA371b506e5db0774aBFeCf8Fc";
  let whale, DAI, USDC, USDT;

  before("Deploy contracts", async () => {
    [alice, bob, john] = await web3.eth.getAccounts();
    controller = await Controller.new();
    vs10Pool = await VS10Pool.new(controller.address);
    strategy = await VFixedStrategy.new(
      controller.address,
      vs10Pool.address,
      "0xbA4cFE5741b357FA371b506e5db0774aBFeCf8Fc"
    );
    await web3.eth.sendTransaction({
      from: alice,
      to: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
      value: toWei(10),
    });

    whale = await unlockAccount("0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503");
    DAI = await ERC20.at("0x6b175474e89094c44da98b954eedeac495271d0f");
    USDC = await ERC20.at("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    USDT = await ERC20.at("0xdac17f958d2ee523a2206206994597c13d831ec7");

    DAI.transfer(alice, toWei(1000000), {from: whale});
    // USDC.transfer(alice, toWei(1000000, 6), {from: whale});
    // USDT.transfer(alice, toWei(1000000, 6), {from: whale});

    // DAI.transfer(bob, toWei(1000000), {from: whale});
    USDC.transfer(bob, toWei(1000000, 6), {from: whale});
    // USDT.transfer(bob, toWei(1000000, 6), {from: whale});

    // DAI.transfer(john, toWei(1000000), {from: whale});
    // USDC.transfer(john, toWei(1000000, 6), {from: whale});
    USDT.transfer(john, toWei(1000000, 6), {from: whale});

    await controller.addPool(vs10Pool.address);
    await controller.updateStrategy(vs10Pool.address, strategy.address);
  });

  it("get balance should work", async () => {
    let _balance = await DAI.balanceOf(alice);
    assert.equal(_balance.toString(), toWei(1000000).toString(), "dai transfer failed");

    // _balance = await USDC.balanceOf(alice);
    // assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "alice usdc transfer failed");

    // _balance = await USDT.balanceOf(alice);
    // assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "alice usdt transfer failed");

    // _balance = await DAI.balanceOf(bob);
    // assert.equal(_balance.toString(), toWei(1000000).toString(), "bob dai transfer failed");

    _balance = await USDC.balanceOf(bob);
    assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "bob usdc transfer failed");

    // _balance = await USDT.balanceOf(bob);
    // assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "bob usdt transfer failed");

    // _balance = await DAI.balanceOf(john);
    // assert.equal(_balance.toString(), toWei(1000000).toString(), "john dai transfer failed");

    // _balance = await USDC.balanceOf(john);
    // assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "john usdc transfer failed");

    _balance = await USDT.balanceOf(john);
    assert.equal(_balance.toString(), toWei(1000000, 6).toString(), "john usdt transfer failed");
  });

  it("deposit should work", async () => {
    console.log("========= Alice DAI deposit ==============");
    await DAI.approve(vs10Pool.address, toWei(1000000), {from: alice});
    await vs10Pool.deposit(DAI.address, toWei(1000000), {from: alice});
    console.log("alice vs10 share balance => ", (await vs10Pool.balanceOf(alice)).toString());

    console.log("========= Bob usdc deposit ==============");
    await USDC.approve(vs10Pool.address, toWei(1000000, 6), {from: bob});
    await vs10Pool.deposit(USDC.address, toWei(1000000, 6), {from: bob});
    console.log("bob vs10 share balance => ", (await vs10Pool.balanceOf(bob)).toString());

    console.log("========= John usdt deposit ==============");
    await USDT.approve(vs10Pool.address, toWei(1000000, 6), {from: john});
    await vs10Pool.deposit(USDT.address, toWei(1000000, 6), {from: john});
    console.log("john vs10 share balance => ", (await vs10Pool.balanceOf(john)).toString());

    console.log("========= Pool total balance ============");
    console.log("total balance => ", (await vs10Pool.totalBalanceOfPool()).toString());
  });

  it("rebalance should work", async () => {
    console.log("======= Initial rebalance ========");
    await vs10Pool.rebalance();
    console.log("======= 30 days after ========");
    await increaseTime(60 * 60 * 24 * 30);
    console.log("======= second rebalance ========");
    await vs10Pool.rebalance();
    await withdrawFromPool(alice, "100000000000000000000000");

    console.log("======= 3 months after ========");
    await increaseTime(60 * 60 * 24 * 90);
    console.log("======= third rebalance ========");
    await vs10Pool.rebalance();
    await withdrawFromPool(bob, "200000000000000000000000");

    console.log("======= 3 months after ========");
    await increaseTime(60 * 60 * 24 * 90);
    console.log("======= firth rebalance ========");
    await vs10Pool.rebalance();
    await withdrawFromPool(john, "1000000000000000000000000");
  });

  const withdrawFromPool = async (from, amount) => {
    console.log("============ Withdram from %s ===============", from);
    let _balanceDAIBefore = await DAI.balanceOf(alice);
    let _balanceUSDCBefore = await USDC.balanceOf(alice);
    let _balanceUSDTBefore = await USDT.balanceOf(alice);

    console.log("balance of DAI Before => ", _balanceDAIBefore.toString());
    console.log("balance of USDC Before => ", _balanceUSDCBefore.toString());
    console.log("balance of USDT Before => ", _balanceUSDTBefore.toString());

    await vs10Pool.withdraw(amount, {from: from});

    let _balanceDAIAfter = await DAI.balanceOf(alice);
    let _balanceUSDCAfter = await USDC.balanceOf(alice);
    let _balanceUSDTAfter = await USDT.balanceOf(alice);
    console.log("balance of DAI after => ", _balanceDAIAfter.toString());
    console.log("balance of USDC after => ", _balanceUSDCAfter.toString());
    console.log("balance of USDT after => ", _balanceUSDTAfter.toString());
    console.log("");
  };

  const increaseTime = async (sec) => {
    await network.provider.send("evm_increaseTime", [sec]);
    await network.provider.send("evm_mine");
  };
});
