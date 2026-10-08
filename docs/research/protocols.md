# Protocol Research Document

## Executive Overview

This technical research document provides a structural and economic breakdown of **Uniswap (v2, v3, and v4)** and **Aave v3**. Automated market makers (AMMs) and pooled lending protocols represent the two primary liquidity primitives in decentralized finance.

Uniswap transitioned from immutable, pairwise constant-product pools (v2) to tick-indexed concentrated liquidity (v3), and ultimately to a monolithic singleton engine governed by transient storage, flash accounting, and modular hooks (v4). Concurrently, Aave evolved from basic pooled lending into a modular, proxy-orchestrated hub-and-spoke system in v3 that enforces multi-tier risk isolation, dynamic utilization curves, and continuous scaled-index balance accounting.

---

# Part I: Uniswap Protocol (v2, v3, v4)

## 1. Architecture and Design Evolution

```
[Uniswap v2]                   [Uniswap v3]                   [Uniswap v4]
Factory / Pair Pattern         Factory / Pool Pattern         Singleton Pattern
┌────────────────────┐         ┌────────────────────┐         ┌────────────────────────┐
│ UniswapV2Factory   │         │ UniswapV3Factory   │         │      PoolManager       │
└─────────┬──────────┘         └─────────┬──────────┘         │ ┌────────────────────┐ │
          │ creates                      │ creates            │ │ mapping(_pools)    │ │
          ▼                              ▼                    │ └────────────────────┘ │
┌────────────────────┐         ┌────────────────────┐         │ Transient Accounting │ │
│  UniswapV2Pair     │         │  UniswapV3Pool     │         │ (EIP-1153 TSTORE)    │ │
│ (x * y = k curve)  │         │ (Concentrated LPs) │         └───────────┬────────────┘
└────────────────────┘         └────────────────────┘                     │ callbacks
                                                                          ▼
                                                              ┌────────────────────────┐
                                                              │  Custom Hook Contract  │
                                                              │ (14 Bitmask Flags)     │
                                                              └────────────────────────┘

```

### Uniswap v2: Pairwise Factory Model

* **Topology:** Distributed factory and pair pattern. The `UniswapV2Factory` uses deterministic `CREATE2` deployments to instantiate independent `UniswapV2Pair` contracts for every asset pair.
* **Liquidity Model:** Continuous and uniform across the entire interval $(0, \infty)$ governed by the constant product invariant:

$$x \cdot y = k$$


* **Position Representation:** Fungible ERC-20 LP tokens issued directly by each pair.
* **Execution Flow:** Push-based pre-funding where callers transfer tokens into the pair contract before invoking state transitions.

### Uniswap v3: Concentrated Liquidity and Tick Ranges

* **Topology:** Distributed factory and pool pattern. `UniswapV3Factory` deploys isolated `UniswapV3Pool` contracts distinguished by token pairs and discrete fee tiers (100, 500, 3,000, 10,000 parts per million).
* **Liquidity Model:** Concentrated liquidity allocated within discrete price intervals bounded by ticks:

$$[\text{tickLower}, \text{tickUpper}]$$



Positions utilize virtual reserves governed by:

$$\left(x + \frac{L}{\sqrt{p_b}}\right)\left(y + L \sqrt{p_a}\right) = L^2$$


* **Position Representation:** Non-fungible ERC-721 tokens issued by the periphery `NonfungiblePositionManager`.
* **Execution Flow:** Pull-based optimistic execution accompanied by mandatory callbacks (`uniswapV3SwapCallback`, `uniswapV3MintCallback`) requiring the caller to transfer funds before transaction completion.



### Uniswap v4: Monolithic Singleton with Flash Accounting and Hooks

* **Topology:** A monolithic singleton architecture centered on `PoolManager`. Individual pool bytecode deployments are eliminated; all pool states exist inside an internal mapping:
`mapping(PoolId => Pool.State) internal _pools`


* **Flash Accounting & EIP-1153:** Transient storage opcodes (`TSTORE`, `TLOAD`) eliminate intermediate physical ERC-20 token transfers. Operations register intra-transaction net balance obligations (`BalanceDelta`). Physical tokens move only when settling net accounts at transaction termination.


* **Hook Architecture:** Extensible pool behavior driven by external contracts (`IHooks`) that expose deterministic callbacks across eight lifecycle steps.


* **Position Representation:** Native multi-token claims standard (ERC-6909) or periphery-wrapped ERC-721 tokens.



---

## 2. Core Smart Contracts

| Protocol Generation | Contract Identifier | Core Architectural Role |
| --- | --- | --- |
| **Uniswap v2** | `UniswapV2Factory` | Registry of pairs; deploys pairs and maintains protocol fee configurations (`feeTo`). |
| **Uniswap v2** | `UniswapV2Pair` | Core invariant enforcement ($x \cdot y = k$), reserve storage, and LP token accounting. |
| **Uniswap v2** | `UniswapV2Router02` | Stateless periphery orchestrator handling slippage limits, multi-hop routing, and WETH wrapping. |
| **Uniswap v3** | `UniswapV3Factory` | Registry of pools across fee tiers; deploys new `UniswapV3Pool` instances. |
| **Uniswap v3** | `UniswapV3Pool` | Concentrated liquidity engine, price ticks, tick bitmaps, and global fee accumulators.

 |
| **Uniswap v3** | `NonfungiblePositionManager` | ERC-721 wrapper managing position boundaries, fee collection, and liquidity stakes. |
| **Uniswap v3** | `SwapRouter` / `UniversalRouter` | Multi-hop trade execution and aggregated execution orchestration.

 |
| **Uniswap v3** | `QuoterV2` | Revert-based off-chain quote generator tracking intermediate tick crossings.

 |
| **Uniswap v4** | `PoolManager` | Singleton repository tracking all pool states, flash accounting deltas, and native ERC-6909 balances.

 |
| **Uniswap v4** | `PositionManager` | Periphery contract exposing batched command execution to mint and modify ERC-721 liquidity positions.

 |
| **Uniswap v4** | `StateView` | Stateless read-only lens contract designed to inspect internal `PoolManager` storage without execution gas overhead.

 |

---

## 3. Key Functions and Execution Lifecycles

### Uniswap v2 Core Entrypoints

* `swap(uint amount0Out, uint amount1Out, address to, bytes data)`: Optimistically sends output assets to `to`. If `data.length > 0`, invokes `IUniswapV2Callee(to).uniswapV2Call()`. Confirms the invariant post-swap:

$$(balance_0 \cdot 1000 - amount0In \cdot 3) \cdot (balance_1 \cdot 1000 - amount1In \cdot 3) \ge reserve_0 \cdot reserve_1 \cdot 1000^2$$


* `mint(address to)`: Compares actual token balances against stored reserves to determine added liquidity; mints pro-rata LP tokens to `to`.
* `burn(address to)`: Burns LP tokens held by the pair contract and transfers proportional underlying tokens to `to`.
* `sync()`: Enforces storage alignment by updating `reserve0` and `reserve1` to match actual contract balances.
* `skim(address to)`: Sweeps excess tokens (balance minus cached reserves) to address `to`.

### Uniswap v3 Core Entrypoints

* `swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes data)`: Executes trade along active ticks via `TickBitmap`. Calls `IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback()` to collect input tokens before verifying post-swap balances.


* `mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes data)`: Computes token requirements at the current $\sqrt{P}$, updates position metrics, and calls `IUniswapV3MintCallback` to pull required assets.


* `burn(int24 tickLower, int24 tickUpper, uint128 amount)`: Deactivates virtual liquidity units and credits owed assets to `tokensOwed0` and `tokensOwed1`.


* `collect(address recipient, int24 tickLower, int24 tickUpper, uint128 amount0Requested, uint128 amount1Requested)`: Withdraws accrued trading fees and burned assets to `recipient`.


* `flash(address recipient, uint256 amount0, uint256 amount1, bytes data)`: Issues uncollateralized loans, calls `IUniswapV3FlashCallback`, and verifies return of principal plus fee premiums.



### Uniswap v4 Core Entrypoints and Flash Accounting Lifecycle

* `unlock(bytes calldata data)`: Core entrypoint for state operations. Obtains an intra-transaction lock, executes `IUnlockCallback(msg.sender).unlockCallback(data)`, and verifies that all net transient debts are resolved:



$$\text{NonzeroDeltaCount} == 0$$



If any balance delta remains unsettled, the call reverts with `CurrencyNotSettled`.


* `modifyLiquidity(PoolKey memory key, IPoolManager.ModifyLiquidityParams memory params, bytes calldata hookData)`: Triggers hook callbacks (`beforeAddLiquidity`/`beforeRemoveLiquidity`), modifies tick allocations, updates caller deltas, and invokes `afterAddLiquidity`/`afterRemoveLiquidity`.


* `swap(PoolKey memory key, IPoolManager.SwapParams memory params, bytes calldata hookData)`: Executes `beforeSwap` on the pool's hook, matches orders across ticks, tracks trading fees, updates caller `BalanceDelta`, and calls `afterSwap`.


* `donate(PoolKey memory key, uint256 amount0, uint256 amount1, bytes calldata hookData)`: Donates tokens directly to in-range liquidity providers without moving the active pool price.


* `settle()` / `take(Currency currency, address to, uint256 amount)`: Settles net debts owed to `PoolManager` or withdraws positive deltas out of `PoolManager`.


* `mint(Currency currency, address to, uint256 amount)` / `burn()`: Converts transient deltas to and from native ERC-6909 claim token balances.



---

## 4. Hook Architecture (Uniswap v4)

In Uniswap v4, hooks are independent contracts whose addresses declare which lifecycle checkpoints they execute via bitwise address flags. Deployed addresses are salt-mined using `CREATE2` to ensure their 14 least significant bits match the required permissions.

| Bit Flag | Mask Constant | Hex Value | Checkpoint Lifecycle Execution |
| --- | --- | --- | --- |
| **Bit 13** | `BEFORE_INITIALIZE_FLAG` | `0x2000` | Executes before pool initialization.

 |
| **Bit 12** | `AFTER_INITIALIZE_FLAG` | `0x1000` | Executes following pool initialization.

 |
| **Bit 11** | `BEFORE_ADD_LIQUIDITY_FLAG` | `0x0800` | Intercepts liquidity additions before position updates.

 |
| **Bit 10** | `AFTER_ADD_LIQUIDITY_FLAG` | `0x0400` | Executes after liquidity additions.

 |
| **Bit 9** | `BEFORE_REMOVE_LIQUIDITY_FLAG` | `0x0200` | Intercepts liquidity removals prior to tick modifications.

 |
| **Bit 8** | `AFTER_REMOVE_LIQUIDITY_FLAG` | `0x0100` | Executes after liquidity removals.

 |
| **Bit 7** | `BEFORE_SWAP_FLAG` | `0x0080` | Pre-swap checkpoint; supports dynamic fee overrides.

 |
| **Bit 6** | `AFTER_SWAP_FLAG` | `0x0040` | Post-swap execution checkpoint.

 |
| **Bit 5** | `BEFORE_DONATE_FLAG` | `0x0020` | Intercepts fee donations before execution. |
| **Bit 4** | `AFTER_DONATE_FLAG` | `0x0010` | Executes following fee donations.

 |
| **Bit 3** | `BEFORE_SWAP_RETURNS_DELTA_FLAG` | `0x0008` | Allows the hook to return custom swap deltas via `BeforeSwapDelta`.

 |
| **Bit 2** | `AFTER_SWAP_RETURNS_DELTA_FLAG` | `0x0004` | Allows the hook to return custom swap deltas after execution. |
| **Bit 1** | `AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG` | `0x0002` | Allows overriding deltas on liquidity additions. |
| **Bit 0** | `AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG` | `0x0001` | Allows overriding deltas on liquidity removals. |

---

## 5. Events and Indexing Subsystems

* **Uniswap v2 (`UniswapV2Pair`):**
* `Mint(address indexed sender, uint amount0, uint amount1)`: Tracks deposited asset amounts.
* `Burn(address indexed sender, uint amount0, uint amount1, address indexed to)`: Tracks withdrawn asset amounts.
* `Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)`: Logs input and output quantities.
* `Sync(uint112 reserve0, uint112 reserve1)`: Records updated internal reserves.


* **Uniswap v3 (`UniswapV3Pool`):**
* `Initialize(uint160 sqrtPriceX96, int24 tick)`: Emitted upon pool instantiation.


* `Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)`: Logs virtual liquidity $\Delta L$ alongside token quantities.


* `Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)`: Logs removed liquidity units.


* `Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)`: Records swap executions with updated curve parameters.


* `Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)`: Logs fee and principal withdrawals.


* `Flash(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1)`: Tracks flash loan volumes and paid premiums.




* **Uniswap v4 (`PoolManager`):**
* `Initialize(PoolId indexed id, Currency indexed currency0, Currency indexed currency1, uint24 fee, int24 tickSpacing, IHooks hooks)`: Records new pool parameters.


* `ModifyLiquidity(PoolId indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta)`: Records changes in virtual liquidity; token quantities must be calculated off-chain from tick bounds and current price.


* `Swap(PoolId indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)`: Records user balance deltas and final pool state.


* `Donate(PoolId indexed id, address indexed sender, uint256 amount0, uint256 amount1)`: Records token distributions to active liquidity providers.





---

## 6. Fee Structure, Revenue Models, and Token Flows

### Fee Mechanics

* **v2 Fee Model:** Static 30 basis points ($0.30\%$) per swap. Fees remain in the pool, compounding $k$.
* **v3 Fee Model:** Tiered static fees ($0.01\%$, $0.05\%$, $0.30\%$, $1.00\%$) aligned with defined tick spacings. Fees do not compound into active liquidity; they accrue separately as claimable tokens via global 128.128 fixed-point growth accumulators (`feeGrowthGlobal0X128`, `feeGrowthGlobal1X128`).
* **v4 Fee Model:** Supports static fees or dynamic fees managed by hooks (enabled when the fee field has its top bit set: `0x800000`). The hook's `beforeSwap` returns an `lpFeeOverride` to adjust fees in real time based on market conditions.



### Protocol Revenue Extraction

* **Uniswap v2:** Governed by `feeTo`. When enabled, the protocol mints new LP tokens upon deposits and withdrawals, capturing 1/6th of growth in $\sqrt{k}$ (5 basis points):

$$S_m = \frac{S_t \cdot (\sqrt{k_2} - \sqrt{k_1})}{5 \cdot \sqrt{k_2} + \sqrt{k_1}}$$


* **Uniswap v3:** Protocol fees are configurable per pool as $1/N$ of the swap fee ($N \in [4, 10]$, representing $10\%$ to $25\%$). Accrued protocol fees are tracked in `protocolFees` and withdrawn via `collectProtocol()`.


* **Uniswap v4:** Protocol fee cuts are managed by an external `IProtocolFeeController`. Fees accrue in `protocolFeesAccrued` and are withdrawn through `collectProtocolFees()`.



### Token Flows Across Versions

* **Uniswap v2:** Caller $\to$ Pair $\to$ Recipient (multi-hop swaps transfer tokens between each pair sequentially).
* **Uniswap v3:** Pool $\to$ Recipient (optimistic output), then Caller $\to$ Pool (callback pull per hop).
* **Uniswap v4:** Caller executes operations inside `unlock()`. Intermediate hops cancel out within `PoolManager` via transient balance deltas. Only the initial input and final output tokens move externally at transaction completion:



$$\text{User} \xrightarrow{\text{settle()}} \text{PoolManager} \quad \text{and} \quad \text{PoolManager} \xrightarrow{\text{take()}} \text{User}$$



---

## 7. Uniswap Protocol Terminology

* **Tick:** A discrete price boundary on the concentrated liquidity curve, where tick $i$ corresponds to price $P(i) = 1.0001^i$.


* **Tick Spacing:** The enforced interval between valid ticks, determined by fee tiers or pool configuration (e.g., tick spacing of 10 or 60).


* **SqrtPriceX96:** The internal representation of price stored as $\sqrt{P} \cdot 2^{96}$ in Q64.96 fixed-point format.


* **BalanceDelta:** A packed 256-bit signed integer (`int128 amount0`, `int128 amount1`) tracking net token debts or credits during Uniswap v4 operations.


* **Flash Accounting:** Uniswap v4's execution model where state changes update transient balances, deferring physical token transfers until the end of the transaction lock.


* **Hook:** An external contract deployed to a deterministic address that executes custom logic at specific lifecycle checkpoints of a v4 pool.


* **ERC-6909:** A multi-token standard implemented by `PoolManager` that tracks internal user balances, enabling low-gas settlements without external ERC-20 transfers.



---

# Part II: Aave Protocol (v3)

## 1. Architecture and Design Evolution

```
                           ┌──────────────────────────┐
                           │   PoolAddressesProvider  │ (Immutable Service Locator)
                           └─────────────┬────────────┘
                                         │ resolves
                                         ▼
                           ┌──────────────────────────┐
                           │      Pool Proxy          │
                           │  (Initializable Proxy)   │
                           └─────────────┬────────────┘
                                         │ delegatecall
                                         ▼
                           ┌──────────────────────────┐
                           │       Pool.sol           │
                           │  (Modular Core Storage)  │
                           └──┬───────┬───────┬─────┬─┘
                              │       │       │     │
         ┌────────────────────┘       │       │     └────────────────────┐
         ▼                            ▼       ▼                          ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   SupplyLogic   │   │   BorrowLogic   │   │ LiquidationLogic│   │   ReserveLogic  │
└─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
         │ mint/burn                  │ mint/burn                        │ updates
         ▼                            ▼                                  ▼
┌─────────────────┐          ┌─────────────────┐                ┌─────────────────┐
│     AToken      │          │VariableDebtToken│                │ Cumulative Ray  │
│(Rebasing Assets)│          │(Rebasing Debts) │                │     Indexes     │
└─────────────────┘          └─────────────────┘                └─────────────────┘

```

* **Hub-and-Spoke Topology:** Coordinated by the `PoolAddressesProvider`, an immutable service locator that resolves addresses for `Pool`, `PoolConfigurator`, `AaveOracle`, `ACLManager`, and interest rate calculation strategies.


* **Modular Execution Libraries:** To circumvent EIP-170 contract size limitations, `Pool.sol` delegates core state transitions to internal libraries: `SupplyLogic`, `BorrowLogic`, `LiquidationLogic`, and `ReserveLogic`.


* **Decoupled Position Accounting:**
* Collateral deposits are tokenized as yield-bearing, rebasing `AToken` contracts.


* Liabilities are tracked via non-transferable `VariableDebtToken` contracts.




* **Role-Based Access Control:** Managed by `ACLManager`, enforcing distinct administrative roles: `POOL_ADMIN`, `EMERGENCY_ADMIN`, `RISK_ADMIN`, `ASSET_LISTING_ADMIN`, and fee-exempt `FLASH_BORROWER`.



---

## 2. Core Smart Contracts

| Contract Identifier | Interface / Implementation | Core Architectural Role |
| --- | --- | --- |
| `PoolAddressesProvider` | `IPoolAddressesProvider` | Immutable market registry resolving addresses for all core components.

 |
| `Pool` | `IPool`, `VersionedInitializable` | Primary user-facing execution entrypoint; coordinates deposits, borrows, repayments, and liquidations.

 |
| `PoolConfigurator` | `IPoolConfigurator` | Administrative contract executing risk adjustments, asset listings, parameter changes, and pause controls.

 |
| `AToken` | `IAToken`, `IncentivizedERC20` | Rebasing yield token representing deposited collateral and accrued interest.

 |
| `VariableDebtToken` | `IVariableDebtToken` | Non-transferable debt token tracking variable-rate borrow obligations.

 |
| `DefaultReserveInterestRateStrategy` | `IReserveInterestRateStrategy` | Piecewise two-slope interest rate engine calculating variable borrow rates based on capital utilization.

 |
| `AaveOracle` | `IAaveOracle` | Primary pricing engine providing asset valuations using Chainlink price feeds.

 |
| `ACLManager` | `IACLManager` | Role-based access control engine enforcing administrative privileges across the protocol.

 |

---

## 3. Key Functions and Execution Lifecycles

### User Interaction Entrypoints

* `supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)`: Transfers assets from the user to the `AToken` contract via `safeTransferFrom`, updates reserve indices via `ReserveLogic`, mints scaled `AToken` shares to `onBehalfOf`, and enables the asset as collateral in user configuration if eligible.


* `withdraw(address asset, uint256 amount, address to)`: Burns scaled `AToken` shares from the caller, verifies that the user's Health Factor remains safe ($HF \ge 1.0$), and transfers the requested underlying asset to `to`.


* `borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)`: Validates reserve caps, checks isolation constraints, ensures the borrower's post-borrow Health Factor satisfies $HF \ge 1.0$, mints `VariableDebtToken` shares, and transfers the borrowed asset to the user.


* `repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)`: Burns the corresponding amount of `VariableDebtToken` shares and transfers underlying assets into the reserve. Passing `type(uint256).max` automatically settles the borrower's full debt balance.


* `setUserUseReserveAsCollateral(address asset, bool useAsCollateral)`: Toggles whether an asset counts toward borrow capacity, verifying that the user's Health Factor remains above $1.0$.



### Liquidation Mechanics (`liquidationCall`)

Liquidations are executed via `liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken)` and follow a structured pipeline:

```
[ liquidationCall Entry ]
          │
          ▼
1. Evaluate Account Health
   └── Verify: Health Factor (HF) < 1.0
          │
          ▼
2. Calculate Close Factor
   ├── If HF >= 0.95 ──> Close Factor = 50%
   └── If HF <  0.95 ──> Close Factor = 100%
          │
          ▼
3. Determine Collateral to Seize (via AaveOracle)
   └── Collateral = (debtToCover * Price_debt / Price_collateral) * (1 + Bonus)
          │
          ▼
4. Settle Balances
   ├── Burn borrower's VariableDebtToken
   └── Transfer collateral to liquidator (or mint ATokens)
          │
          ▼
5. Allocate Protocol Fees
   └── Deduct liquidationProtocolFee and mint ATokens to DAO Treasury

```

1. **Insolvency Check:** Confirms that the borrower's account has a Health Factor strictly below $1.0$.


2. **Close Factor Resolution:** By default, liquidators can liquidate up to $50\%$ (`closeFactor = 0.5`) of the user's outstanding debt. If the Health Factor falls below `CLOSE_FACTOR_HF_THRESHOLD` (typically $0.95$), the close factor expands to $100\%$ (`1.0`), permitting complete position liquidation.


3. **Collateral Calculation:** Evaluates asset prices via `AaveOracle`. Calculates the seized collateral amount including the liquidation bonus:



$$\text{CollateralToSeize} = \frac{\text{debtToCover} \times \text{Price}_{\text{debt}}}{\text{Price}_{\text{collateral}}} \times (1 + \text{LiquidationBonus})$$


4. **Settlement:** Burns the borrower's `VariableDebtToken` shares, transfers seized assets to the liquidator (or mints equivalent `AToken` shares), and redirects a portion of the bonus (`liquidationProtocolFee`) to the Aave DAO treasury as `AToken` shares.



### Flash Loan Entrypoints

* `flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode)`: Issues a single-asset flash loan and verifies return of principal plus fee premiums upon callback completion.


* `flashLoan(address receiverAddress, address[] calldata assets, uint256[] calldata amounts, uint256[] calldata interestRateModes, address onBehalfOf, bytes calldata params, uint16 referralCode)`: Multi-asset flash loan that can convert unpaid loans into active variable-rate debt positions if specified in `interestRateModes`.



---

## 4. Events and Indexing Subsystems

Aave v3 emits operational and accounting events through `IPool`:

* `Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)`: Emitted upon asset deposits.


* `Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)`: Emitted upon asset withdrawals.
* `Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)`: Logs borrow originations and applied interest rates.


* `Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)`: Emitted upon debt repayments.
* `LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)`: Details liquidated positions, repaid debts, and seized collateral.


* `FlashLoan(address indexed target, address initiator, address indexed asset, uint256 amount, uint256 interestRateMode, uint256 premium, uint16 indexed referralCode)`: Emitted upon flash loan execution.


* `ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)`: Emitted on reserve state updates; provides cumulative Ray indexes ($I_{\text{liquidity}}, I_{\text{variableBorrow}}$) for off-chain balance reconstruction.

---

## 5. Economic Mechanics and Revenue Models

### Dynamic Interest Rate Model

Aave v3 calculates borrow rates using a two-slope utilization model implemented in `DefaultReserveInterestRateStrategy`:

* **Capital Utilization ($U$):**

$$U = \frac{D_{\text{total}}}{D_{\text{total}} + L_{\text{available}}}$$


* **Piecewise Borrow Rate ($R_t$):**
* When $U < U_{\text{optimal}}$:

$$R_t = R_0 + \frac{U}{U_{\text{optimal}}} \cdot R_{\text{slope1}}$$


* When $U \ge U_{\text{optimal}}$:

$$R_t = R_0 + R_{\text{slope1}} + \left( \frac{U - U_{\text{optimal}}}{1 - U_{\text{optimal}}} \right) \cdot R_{\text{slope2}}$$



The second slope ($R_{\text{slope2}}$) increases borrow rates steeply above optimal utilization to incentivize repayments and protect pool liquidity.


* **Supplier Liquidity Rate ($R_{\text{liquidity}}$):**

$$R_{\text{liquidity}} = U \cdot R_t \cdot (1 - RF)$$



### Protocol Revenue Inflows

1. **Reserve Factor ($RF$):** Allocates a configurable percentage (typically $10\%$ to $35\%$) of borrower-paid interest to the Aave DAO Treasury. During state updates in `ReserveLogic.updateState()`, equivalent `AToken` shares are minted to the treasury.


2. **Flash Loan Premiums:** A standard 5 basis point ($0.05\%$) fee is charged on flash loan principal. Of this:



* 4 basis points ($0.04\%$) are routed to the Aave DAO Treasury.


* 1 basis point ($0.01\%$) is distributed to liquidity suppliers.


* Accounts holding the `FLASH_BORROWER` role in `ACLManager` bypass this fee.



3. **Liquidation Protocol Fee:** When unhealthy positions are liquidated, a configured percentage of the liquidation bonus is redirected to the protocol treasury as `AToken` shares.



---

## 6. Token Flows and Scaled Balance Accounting

Aave uses scaled balances and cumulative Ray indexes ($10^{27}$ precision) in `WadRayMath` to track continuous interest compounding without iterating over individual accounts.

```
User Balance Resolution:
Collateral Balance = Scaled Balance (AToken)           * Current Liquidity Index
Debt Liability     = Scaled Balance (VariableDebtToken)* Current Variable Borrow Index

```

* **Index Compounding:** When a reserve updates, indices advance based on elapsed time:

$$I(t) = I(t_0) \cdot \left(1 + \frac{R \cdot \Delta t}{31536000}\right)$$


* **Scaled Deposits:**

$$S_B = S_B + \frac{\text{amountDeposited}}{I_{\text{liquidity}}(t)}$$


* **Scaled Borrows:**

$$S_D = S_D + \frac{\text{amountBorrowed}}{I_{\text{variableBorrow}}(t)}$$


* **Dynamic Resolution:**

$$\text{Real Collateral} = S_B \cdot I_{\text{liquidity}}(t), \quad \text{Real Debt} = S_D \cdot I_{\text{variableBorrow}}(t)$$



---

## 7. Risk Management Frameworks

Aave v3 manages risk through a packed 256-bit bitmap structure (`ReserveConfigurationMap`) alongside isolation features:

* **Efficiency Mode (eMode):** Groups correlated assets (e.g., stablecoin pairs or pegged wrappers) into specialized risk profiles. Within an eMode category, collateral parameters expand: LTVs reach up to $97\%$, liquidation thresholds reach up to $98\%$, and liquidation bonuses compress to $1\%-2\%$, supporting capital-efficient borrowing.


* **Isolation Mode:** Restricts newly listed or volatile collateral assets. Accounts using isolated collateral cannot supply other collateral types and can borrow only authorized stablecoins up to a defined `debtCeiling`.


* **Supply and Borrow Caps:** Governance limits total deposits and borrows per reserve to prevent pool manipulation and mitigate illiquidity risks.


* **Siloed Borrowing:** Restricts designated volatile assets from being borrowed alongside other assets within the same account.
* **Portals (Cross-Chain Infrastructure):** Allows approved bridge contracts (`BRIDGE` role) to call `mintUnbacked()` on a destination chain and settle the backing later via `backUnbacked()` once cross-chain transfers clear.



---

## 8. Aave Protocol Terminology

* **Health Factor ($HF$):** Numerical ratio representing account solvency, calculated as liquidation-threshold-weighted collateral divided by total borrow debt. Positions are eligible for liquidation when $HF < 1.0$.


* **Loan to Value (LTV):** Maximum borrowing power unlocked by a collateral asset. For example, an LTV of $80\%$ permits borrowing up to $\$800$ against $\$1,000$ of collateral.


* **Liquidation Threshold:** The collateral utilization limit at which a position is considered undercollateralized and becomes subject to liquidation.


* **Liquidation Bonus (Penalty):** Collateral discount awarded to liquidators for repaying unhealthy debt (e.g., a $105\%$ bonus awards $\$105$ in collateral per $\$100$ of debt covered).


* **Close Factor:** The maximum percentage of outstanding debt a liquidator can repay in a single liquidation transaction ($50\%$ by default, expanding to $100\%$ when $HF < 0.95$).


* **Reserve Factor:** The percentage of borrow interest diverted to the protocol treasury rather than liquidity suppliers.


* **Ray:** A 27-decimal fixed-point numerical representation ($1 \text{ Ray} = 10^{27}$) implemented in `WadRayMath` to prevent precision loss during interest rate compounding.


* **Scaled Balance:** The internal balance stored by `AToken` and `VariableDebtToken` contracts, representing underlying tokens divided by the cumulative index at transaction time.


* **Portals:** Cross-chain bridge primitives allowing approved protocols to mint unbacked $a\text{Tokens}$ that are subsequently backed once cross-chain funds settle.



---

# Part III: Comparative Architectural Synthesis

The following table summarizes the core technical trade-offs across Uniswap and Aave generations:

| Architectural Dimension | Uniswap v2 | Uniswap v3 | Uniswap v4 | Aave v3 |
| --- | --- | --- | --- | --- |
| **System Pattern** | Factory / Pair isolation | Factory / Pool isolation | Monolithic Singleton (`PoolManager`)

 | Hub-and-Spoke via `PoolAddressesProvider`<br> |
| **State Structure** | Isolated per-pair variables | Isolated per-pool variables

 | Central storage mapping + Transient Storage

 | Central `Pool` storage mapped to library logic

 |
| **Capital Paradigm** | Continuous curve $(0, \infty)$ | Concentrated tick ranges $[\text{tickLower}, \text{tickUpper}]$<br> | Concentrated ranges with customizable hook curves

 | Pooled collateral backing multi-asset debt positions

 |
| **Position Token** | Homogeneous ERC-20 | ERC-721 NFT | ERC-6909 Claims or ERC-721 NFT

 | Rebasing ERC-20 (`AToken`, `VariableDebtToken`)

 |
| **Settlement Timing** | Immediate transfer per swap | Immediate transfer via callbacks

 | Flash accounting; settled at transaction end

 | Immediate transfer with index balance tracking

 |
| **Extensibility** | None (immutable logic) | Periphery routers and fee tiers

 | Address bitmask hook contracts (`IHooks`)

 | Pluggable rate strategies and flash receivers

 |
| **Protocol Revenue** | Dilution of pool shares ($\sqrt{k}$) | Swap fee split ($1/N$) via `collectProtocol()`<br> | Protocol fee split via `IProtocolFeeController`<br> | Reserve Factor, Flash Loan Fees, Liquidation Fees

 |
| **Risk Containment** | Structural pool isolation | Structural pool isolation | Shared state; isolation enforced by Hook logic

 | Bitmap risk engine, eMode, Isolation Mode, and Caps

 |