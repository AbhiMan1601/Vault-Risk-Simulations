import { createPublicClient, http, parseAbi } from 'viem'; 
import { mainnet } from 'viem/chains';
// importing modules for price extraction from mainnet public RPC node

// 1. Initialize the public client pointing to Ethereum Mainnet (flashbots personal favourite lol)
const client = createPublicClient({
  chain: mainnet,
  transport: http('https://mevblocker.io'), // High uptime, zero signup required
});


// 2. Define Morpho Blue Mainnet Contract Address and Target Market ID
const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

// Market ID for WETH (Collateral) / USDC (Loan) - 86% LLTV
const WETH_USDC_MARKET_ID = '0xc54d640641e7798fe85694c9657754f9a066ec568b209d8aa04d9a5b6f38db15';

// 3. Define the minimal ABIs required
const morphoBlueAbi = parseAbi([
  'function markets(bytes32 id) external view returns (address collateralToken, address loanToken, address oracle, uint32 lltv, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 totalDepositAssets, uint128 totalDepositShares)'
]);

const oracleAbi = parseAbi([
  'function price() external view returns (uint256)'
]);

async function getMorphoPriceFeed() {
  try {
    console.log('🔍 Fetching market parameters from Morpho Blue...');
    
    // 4. Fetch the market struct from Morpho Blue to isolate the oracle address
    const marketInfo = await client.readContract({
      address: MORPHO_BLUE_ADDRESS,
      abi: morphoBlueAbi,
      functionName: 'markets',
      args: [WETH_USDC_MARKET_ID as `0x${string}`],
    });

    const oracleAddress = marketInfo[2]; // The 3rd value returned is the oracle address
    console.log(`📌 Oracle Address found: ${oracleAddress}`);

    // 5. Setup a polling loop to create a price "feed"
    console.log('\n🚀 Starting Live Price Feed (Updating every 12 seconds)...');
    
    setInterval(async () => {
      try {
        // Query the oracle contract directly
        const rawPrice = await client.readContract({
          address: oracleAddress,
          abi: oracleAbi,
          functionName: 'price',
        });

        /*
         * 6. Format the Price Math:
         * Morpho Oracles scale the price by: (Collateral Price in USD / Loan Price in USD) * 10^(36 + loanDecimals - collateralDecimals)
         * For WETH (18 decimals) and USDC (6 decimals):
         * Scale Factor = 36 + 6 - 18 = 24
         */
        const scaleFactor = 36 + 6 - 18;
        const formattedPrice = Number(rawPrice) / Math.pow(10, scaleFactor);

        console.log(`⏰ [${new Date().toLocaleTimeString()}] 1 WETH = ${formattedPrice.toFixed(2)} USDC`);
      } catch (error) {
        console.error('❌ Error fetching price tick:', error);
      }
    }, 12000); // Poll roughly every Ethereum block (12 seconds)

  } catch (error) {
    console.error('💥 Initialization Error:', error);
  }
}

getMorphoPriceFeed();