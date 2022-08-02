const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');
const fs = require('fs')
const rawPairsInfo = fs.readFileSync('./config/pancakeswappair.json');
const pairsInfo =  JSON.parse(rawPairsInfo);
const pairsInfoLength = Object.keys(pairsInfo).length;
const ERC20_ABI = require('../contracts/providers/uniswapV2/abi/IERC20.json');

describe('pancakeswap', () => {
  let owner, user;
  let weth, wethAddress;
  let borrower;
  let maxEthBal = BigNumber.from(0), totalEthBal = BigNumber.from(0);

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://bsc-dataseed4.binance.org"
          },
        },
      ],
    });

    wethHolderAddress = "0xf977814e90da44bfa03b6295a0616a897441acec";
    wethAddress = "0x2170ed0880ac9a755fd29b2688956bd959f933f8";
    weth = await ethers.getContractAt(ERC20_ABI, wethAddress);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [wethHolderAddress]
    })

    wethuser = await hre.ethers.provider.getSigner(wethHolderAddress)

    const PancakeswapFlashLender = await ethers.getContractFactory('PancakeswapFlashLender');
    const PancakeswapFlashBorrower = await ethers.getContractFactory('PancakeswapFlashBorrower');

    lender = await PancakeswapFlashLender.deploy();
    borrower = await PancakeswapFlashBorrower.deploy();

    let tokens0 = []
    let tokens1 = []
    let pairs = []

    for (let i = 1; i <= pairsInfoLength; i++) {
      tokens0.push(pairsInfo[i].tokens0);
      tokens1.push(pairsInfo[i].tokens1);
      pairs.push(pairsInfo[i].pairs);
    }

    await lender.addPairs(tokens0, tokens1, pairs);

    for (let i = 1; i <= pairsInfoLength; i++) {
      if(wethAddress == pairsInfo[i].tokens0 || wethAddress == pairsInfo[i].tokens1){
        let tempBal = await weth.balanceOf(pairsInfo[i].pairs)
        if(tempBal.gt(BigNumber.from(1))) {
          totalEthBal = totalEthBal.add(tempBal).sub(1);
          if(maxEthBal.lt(tempBal.sub(1))){
            maxEthBal = tempBal.sub(1);        
          }
        }
      }
    }
  });

  it('flash supply', async function () {
    beforeETH = await ethers.provider.getBalance(user.address);
    console.log("beforeETH", beforeETH.toString());
    expect(await lender.maxFlashLoan(wethAddress, maxEthBal)).to.equal(maxEthBal);
    afterETH = await ethers.provider.getBalance(user.address);
    console.log("afterETH", afterETH.toString());
    let feeETH = ethers.BigNumber.from(beforeETH).sub(afterETH);
    console.log("feeETH", feeETH.toString());

    expect(await lender.maxFlashLoan(wethAddress, maxEthBal.add(1))).to.equal(0);

    beforeETH2 = await ethers.provider.getBalance(user.address);
    console.log("beforeETH2", beforeETH2.toString());
    expect(await lender.maxFlashLoanWithManyPairs_OR_ManyPools(wethAddress)).to.equal(totalEthBal);
    afterETH2 = await ethers.provider.getBalance(user.address);
    console.log("afterETH2", afterETH2.toString());
    let feeETH2 = ethers.BigNumber.from(beforeETH2).sub(afterETH2);
    console.log("feeETH2", feeETH2.toString());
  });

  it('flash fee', async function () {
    beforeETH = await ethers.provider.getBalance(user.address);
    console.log("beforeETH", beforeETH.toString());
    expect(await lender.flashFee(weth.address, maxEthBal)).to.equal((maxEthBal.mul(25).div(9975).add(1)));
    afterETH = await ethers.provider.getBalance(user.address);
    console.log("afterETH", afterETH.toString());
    let feeETH = ethers.BigNumber.from(beforeETH).sub(afterETH);
    console.log("feeETH", feeETH.toString());

    expect(await lender.flashFee(weth.address, maxEthBal.add(1))).to.equal(0);

    beforeETH2 = await ethers.provider.getBalance(user.address);
    console.log("beforeETH2", beforeETH2.toString());
    fee = await lender.flashFeeWithManyPairs_OR_ManyPools(weth.address, totalEthBal);
    expect(fee).to.equal((totalEthBal.mul(25).div(9975).add(1)));
    afterETH2 = await ethers.provider.getBalance(user.address);
    console.log("afterETH2", afterETH2.toString());
    let feeETH2 = ethers.BigNumber.from(beforeETH2).sub(afterETH2);
    console.log("feeETH2", feeETH2.toString());
  });

  it('flashLoan', async () => {
    beforeETH = await ethers.provider.getBalance(user.address);
    console.log("beforeETH", beforeETH.toString());
    const maxloan = BigNumber.from(await lender.connect(wethuser).maxFlashLoan(weth.address, 1));
    const fee = BigNumber.from(await lender.connect(wethuser).flashFee(weth.address, maxloan));
    await weth.connect(wethuser).transfer(borrower.address, fee);
    await borrower.connect(user).flashBorrow(lender.address, weth.address, maxloan, {gasLimit: 30000000});
    const totalFlashBalance = await borrower.totalFlashBalance();
    expect(totalFlashBalance).to.equal(maxloan.add(fee));
    afterETH = await ethers.provider.getBalance(user.address);
    console.log("afterETH", afterETH.toString());
    let feeETH = ethers.BigNumber.from(beforeETH).sub(afterETH);
    console.log("feeETH", feeETH.toString());
  });

  it('flashLoanWithManyPairs_OR_ManyPools', async () => {
    beforeETH = await ethers.provider.getBalance(user.address);
    console.log("beforeETH", beforeETH.toString());
    const maxloan = BigNumber.from(await lender.connect(wethuser).maxFlashLoanWithManyPairs_OR_ManyPools(weth.address, {gasLimit: 30000000}));
    fee = await lender.connect(wethuser).flashFeeWithManyPairs_OR_ManyPools(weth.address, maxloan, {gasLimit: 30000000});
    console.log("fee", fee.toString());
    await weth.connect(wethuser).transfer(borrower.address, fee, {gasLimit: 30000000});
    await borrower.connect(user).flashBorrowWithManyPairs_OR_ManyPools(lender.address, weth.address, maxloan, {gasLimit: 30000000});
    const totalFlashBalance = await borrower.totalFlashBalance();
    expect(totalFlashBalance).to.lte(maxloan.add(fee));
    // expect(totalFlashBalance).to.gte(maxloan.add(fee).sub(pairCount));
    afterETH = await ethers.provider.getBalance(user.address);
    console.log("afterETH", afterETH.toString());
    let feeETH = ethers.BigNumber.from(beforeETH).sub(afterETH);
    console.log("feeETH", feeETH.toString());
  });
});
